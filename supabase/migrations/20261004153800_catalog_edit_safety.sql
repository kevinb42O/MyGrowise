create table public.catalog_slug_aliases(slug text primary key,product_id uuid not null references public.products(id) on delete cascade);
alter table public.catalog_slug_aliases enable row level security;
revoke all on public.catalog_slug_aliases from anon,authenticated;
grant all on public.catalog_slug_aliases to service_role;
create function public.guard_catalog_product_edit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(104041511);
 if exists(select 1 from public.catalog_slug_aliases where slug=new.slug and product_id<>new.id) then raise exception 'reserved_catalog_slug';end if;
 if tg_op='UPDATE' then
  if old.type='questionnaire' and new.type<>'questionnaire' and exists(select 1 from public.catalog_components where questionnaire_id=old.id) then raise exception 'questionnaire_used_in_package'; end if;
  if old.slug<>new.slug and exists(select 1 from public.catalog_details where product_id=old.id) then insert into public.catalog_slug_aliases(slug,product_id) values(old.slug,old.id) on conflict(slug) do update set product_id=excluded.product_id;end if;
 end if;return new;
end $$;
create trigger catalog_product_edit_guard before insert or update of slug,type on public.products for each row execute function public.guard_catalog_product_edit();
revoke all on function public.guard_catalog_product_edit() from public,anon,authenticated;
-- Explicitly finalize a crashed last attempt instead of leaving it forever leased.
create or replace function public.claim_commerce_mail(p_limit integer,p_order_id uuid default null) returns setof public.commerce_mail_jobs language plpgsql security definer set search_path='' as $$
begin
 update public.commerce_mail_jobs set status='failed',lease_until=null,last_error='lease_expired' where status='sending' and lease_until<now() and attempts>=6;
 return query update public.commerce_mail_jobs set status='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
 where id in(select id from public.commerce_mail_jobs where (status='pending' or(status='sending' and lease_until<now())) and next_attempt_at<=now() and attempts<6 and(p_order_id is null or order_id=p_order_id) order by created_at limit least(greatest(p_limit,1),20) for update skip locked) returning *;
end $$;
revoke all on function public.claim_commerce_mail(integer,uuid) from public,anon,authenticated;
