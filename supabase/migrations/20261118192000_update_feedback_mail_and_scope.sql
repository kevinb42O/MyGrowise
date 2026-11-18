-- Additive only: no existing appointments, mail queues or clinical records change.
alter table public.platform_updates add column audience text not null default 'dashboard' check(audience in ('website','dashboard'));
update public.platform_updates set audience='website' where category in ('Website','Aanbod & aankopen');

create table public.platform_update_mail_jobs (
 id uuid primary key default gen_random_uuid(),comment_id uuid not null unique references public.platform_update_comments(id),
 recipient text not null default 'bourguignonphotography@gmail.com' check(recipient='bourguignonphotography@gmail.com'),
 payload jsonb not null,status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),lease_until timestamptz,lease_token uuid,
 created_at timestamptz not null default now(),sent_at timestamptz,last_error text
);
create index platform_update_mail_pending on public.platform_update_mail_jobs(status,next_attempt_at);
alter table public.platform_update_mail_jobs enable row level security;
revoke all on public.platform_update_mail_jobs from anon,authenticated;
grant all on public.platform_update_mail_jobs to service_role;

create function public.queue_platform_update_feedback() returns trigger language plpgsql security definer set search_path=public as $$
declare u platform_updates; sender_email text; parent_body text; milestone_title text;
begin
 select email into sender_email from auth.users where id=new.author_id;
 -- The designer's own dashboard replies should not notify his own mailbox.
 if lower(coalesce(sender_email,''))='bourguignonphotography@gmail.com' then return new; end if;
 select * into strict u from platform_updates where id=new.update_id;
 if new.reply_to is not null then select body into parent_body from platform_update_comments where id=new.reply_to; end if;
 if new.event_id is not null then select title into milestone_title from platform_update_events where id=new.event_id; end if;
 insert into platform_update_mail_jobs(comment_id,payload) values(new.id,jsonb_build_object(
  'comment_id',new.id,'slug',u.slug,'title',u.title,'summary',u.summary,'status',u.status,'next_step',u.next_step,
  'category',u.category,'audience',u.audience,'author_name',new.author_name,'author_email',sender_email,'body',new.body,
  'created_at',new.created_at,'parent_body',parent_body,'milestone_title',milestone_title));
 return new;
end $$;
revoke all on function public.queue_platform_update_feedback() from public,anon,authenticated;
create trigger platform_update_feedback_queued after insert on public.platform_update_comments for each row execute function public.queue_platform_update_feedback();

create function public.claim_platform_update_mail(p_limit integer default 2,p_comment uuid default null) returns setof public.platform_update_mail_jobs
language plpgsql set search_path=public as $$
begin
 update platform_update_mail_jobs set status='failed',lease_until=null,lease_token=null,last_error='delivery_failed' where status='sending' and lease_until<now() and attempts>=6;
 return query with selected as (
  select id from platform_update_mail_jobs where (p_comment is null or comment_id=p_comment) and attempts<6
  and ((status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now()))
  order by created_at,id for update skip locked limit least(5,greatest(1,p_limit))
 ) update platform_update_mail_jobs j set status='sending',attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 from selected s where j.id=s.id returning j.*;
end $$;
revoke all on function public.claim_platform_update_mail(integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_platform_update_mail(integer,uuid) to service_role;

-- Audience is a new optional argument; the old five-argument call remains compatible.
drop function public.list_platform_updates(uuid,text,text,integer,boolean);
create function public.list_platform_updates(p_actor uuid,p_filter text,p_query text,p_offset integer,p_unread boolean default false,p_audience text default 'all')
returns table(id uuid,slug text,title text,summary text,body text,next_step text,status text,published boolean,category text,revision integer,created_at timestamptz,updated_at timestamptz,action_path text,action_label text,content_revision integer,audience text,unread boolean,total_count bigint)
language sql stable set search_path=public as $$
 select u.id,u.slug,u.title,u.summary,u.body,u.next_step,u.status,u.published,u.category,u.revision,u.created_at,u.updated_at,u.action_path,u.action_label,u.content_revision,u.audience,u.revision>coalesce(r.revision,0),count(*) over() from platform_updates u left join platform_update_reads r on r.update_id=u.id and r.user_id=p_actor
 where exists(select 1 from user_roles where user_id=p_actor and role::text='super_admin')
 and u.published=(p_filter<>'drafts') and (not p_unread or u.revision>coalesce(r.revision,0))
 and (p_audience='all' or u.audience=p_audience)
 and (p_filter not in ('active','released','history') or (p_filter='active' and u.status in ('planned','in_progress','review','paused')) or (p_filter='released' and u.status='released') or (p_filter='history' and u.status='historical'))
 and (coalesce(p_query,'')='' or position(lower(p_query) in lower(u.title||' '||u.summary||' '||u.body))>0)
 order by case when u.status in ('planned','in_progress','review','paused') then 0 else 1 end,u.updated_at desc,u.id limit 12 offset greatest(0,p_offset)
$$;
revoke all on function public.list_platform_updates(uuid,text,text,integer,boolean,text) from public,anon,authenticated;
grant execute on function public.list_platform_updates(uuid,text,text,integer,boolean,text) to service_role;

-- Keep editorial writes atomic while adding the new field. Delegate to the already
-- checked implementation; any audience validation failure rolls the whole write back.
alter function public.mutate_platform_update(uuid,text,text,uuid,jsonb) rename to mutate_platform_update_core;
revoke all on function public.mutate_platform_update_core(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
create function public.mutate_platform_update(p_actor uuid,p_name text,p_action text,p_id uuid,p_data jsonb) returns uuid
language plpgsql set search_path=public as $$
declare result_id uuid;
begin
 result_id:=mutate_platform_update_core(p_actor,p_name,p_action,p_id,p_data);
 if p_action in ('create','edit') then update platform_updates set audience=coalesce(p_data->>'audience','dashboard') where id=result_id; end if;
 return result_id;
end $$;
revoke all on function public.mutate_platform_update(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_platform_update(uuid,text,text,uuid,jsonb) to service_role;
