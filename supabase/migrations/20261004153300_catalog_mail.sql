create table public.commerce_mail_jobs (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 delivery_id uuid references public.assessment_deliveries(id) on delete cascade,
 event text not null check(event in ('created','paid','delivery')),target text not null check(target in ('customer','team')),
 event_key text not null unique,status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_until timestamptz,lease_token uuid,
 sent_at timestamptz,last_error text,created_at timestamptz not null default now()
);
alter table public.commerce_mail_jobs enable row level security;
revoke all on public.commerce_mail_jobs from anon,authenticated;
grant all on public.commerce_mail_jobs to service_role;
create function public.queue_commerce_order_mail() returns trigger language plpgsql security definer set search_path='' as $$
declare v_event text;v_target text;
begin
 if new.provider<>'wise_manual' then return new;end if;
 if tg_op='INSERT' and new.status='pending_payment' then v_event:='created';
 elsif tg_op='UPDATE' and new.status in ('paid','fulfilled') and old.status not in ('paid','fulfilled') then v_event:='paid';else return new;end if;
 foreach v_target in array array['customer','team'] loop
  insert into public.commerce_mail_jobs(order_id,event,target,event_key) values(new.id,v_event,v_target,new.id::text||':'||v_event||':'||v_target) on conflict do nothing;
 end loop;
 return new;
end $$;
create trigger commerce_order_mail after insert or update of status on public.orders for each row execute function public.queue_commerce_order_mail();
create function public.queue_commerce_delivery_mail() returns trigger language plpgsql security definer set search_path='' as $$
declare v_order uuid;
begin
 if new.status is distinct from old.status or new.external_url is distinct from old.external_url or new.report_path is distinct from old.report_path then
  select order_id into v_order from public.order_items where id=new.order_item_id;
  insert into public.commerce_mail_jobs(order_id,delivery_id,event,target,event_key) values(v_order,new.id,'delivery','customer',new.id::text||':'||new.updated_at::text) on conflict do nothing;
 end if;return new;
end $$;
create trigger commerce_delivery_mail after update on public.assessment_deliveries for each row execute function public.queue_commerce_delivery_mail();
create function public.claim_commerce_mail(p_limit integer,p_order_id uuid default null) returns setof public.commerce_mail_jobs language sql security definer set search_path='' as $$
 update public.commerce_mail_jobs set status='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
 where id in (select id from public.commerce_mail_jobs where (status='pending' or(status='sending' and lease_until<now())) and next_attempt_at<=now() and attempts<6 and (p_order_id is null or order_id=p_order_id) order by created_at limit least(greatest(p_limit,1),20) for update skip locked) returning *;
$$;
revoke all on function public.queue_commerce_order_mail(),public.queue_commerce_delivery_mail(),public.claim_commerce_mail(integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_commerce_mail(integer,uuid) to service_role;
