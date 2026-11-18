-- Private editorial updates. Browser roles never access these tables or RPCs.
create table public.platform_updates (
 id uuid primary key default gen_random_uuid(), slug text unique not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=120),
 title text not null check(length(title) between 3 and 160), summary text not null check(length(summary) between 3 and 350),
 body text not null check(length(body) between 3 and 12000), next_step text not null default '' check(length(next_step)<=1200),
 category text not null check(category in ('Werkruimte','Agenda & cliënten','Website','Aanbod & aankopen')),
 status text not null default 'planned' check(status in ('planned','in_progress','review','released','paused','cancelled','historical')),
 published boolean not null default false, revision integer not null default 1,content_revision integer not null default 1,
 action_path text check(action_path is null or (action_path ~ '^/[a-z0-9/-]+$' and action_path !~ '^//')), action_label text check(length(action_label)<=80),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.platform_update_events (
 id uuid primary key default gen_random_uuid(), update_id uuid not null references public.platform_updates on delete cascade,
 title text not null check(length(title) between 3 and 160),body text not null check(length(body) between 3 and 4000),
 status text not null,position integer not null default 1,revision integer not null,created_at timestamptz not null default now()
);
create index platform_update_events_parent on public.platform_update_events(update_id,created_at,id);
create table public.platform_update_comments (
 id uuid primary key, update_id uuid not null references public.platform_updates on delete cascade,
 author_id uuid references public.profiles(id) on delete set null,author_name text not null,
 body text not null check(length(body) between 1 and 4000),reply_to uuid references public.platform_update_comments,
 event_id uuid references public.platform_update_events,
 feedback_status text not null default 'received' check(feedback_status in ('received','handling','answered')),
 revision integer not null,created_at timestamptz not null default now()
);
create index platform_update_comments_parent on public.platform_update_comments(update_id,created_at,id);
create table public.platform_update_reads (
 user_id uuid references public.profiles on delete cascade,update_id uuid references public.platform_updates on delete cascade,
 revision integer not null,primary key(user_id,update_id)
);
create index platform_updates_recent on public.platform_updates(published,updated_at desc,id);
create function public.mutate_platform_update(p_actor uuid,p_name text,p_action text,p_id uuid,p_data jsonb) returns uuid
language plpgsql set search_path=public as $$
declare u platform_updates; result_id uuid; new_revision integer; parent_id uuid;
begin
 if not exists(select 1 from user_roles where user_id=p_actor and role::text='super_admin') then raise exception 'forbidden'; end if;
 if p_action='create' then
  insert into platform_updates(slug,title,summary,body,next_step,status,category,published,action_path,action_label)
  values(p_data->>'slug',p_data->>'title',p_data->>'summary',p_data->>'body',coalesce(p_data->>'next_step',''),p_data->>'status',p_data->>'category',coalesce((p_data->>'published')::boolean,false),nullif(p_data->>'action_path',''),nullif(p_data->>'action_label','')) returning * into u;
  insert into platform_update_events(update_id,title,body,status,revision) values(u.id,'Het begin',u.summary,u.status,1);
 else
  select * into u from platform_updates where id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_action='read' then
   insert into platform_update_reads values(p_actor,u.id,least(u.revision,(p_data->>'revision')::integer)) on conflict(user_id,update_id) do update set revision=greatest(platform_update_reads.revision,excluded.revision);
   return u.id;
  end if;
  if p_action in ('edit','event') and (p_data->>'revision')::integer is distinct from u.revision then raise exception 'conflict'; end if;
  new_revision:=u.revision+1;
  if p_action='edit' then
   update platform_updates set title=p_data->>'title',summary=p_data->>'summary',body=p_data->>'body',next_step=coalesce(p_data->>'next_step',''),category=p_data->>'category',published=(p_data->>'published')::boolean,action_path=nullif(p_data->>'action_path',''),action_label=nullif(p_data->>'action_label',''),
    content_revision=case when (p_data->>'notify')::boolean or published is distinct from (p_data->>'published')::boolean then new_revision else content_revision end,
    revision=case when (p_data->>'notify')::boolean or published is distinct from (p_data->>'published')::boolean then new_revision else revision end,
    updated_at=case when (p_data->>'notify')::boolean or published is distinct from (p_data->>'published')::boolean then now() else updated_at end where id=u.id;
  elsif p_action='event' then
   update platform_updates set status=p_data->>'status',next_step=p_data->>'next_step',revision=new_revision,updated_at=now() where id=u.id;
   insert into platform_update_events(update_id,title,body,status,revision,position) values(u.id,p_data->>'title',p_data->>'body',p_data->>'status',new_revision,(select count(*)+1 from platform_update_events where update_id=u.id));
  elsif p_action='comment' then
   result_id:=(p_data->>'token')::uuid;
   if exists(select 1 from platform_update_comments where id=result_id and author_id=p_actor and update_id=u.id) then return u.id; end if;
   parent_id:=nullif(p_data->>'reply_to','')::uuid;
   if parent_id is not null and not exists(select 1 from platform_update_comments where id=parent_id and update_id=u.id and author_id<>p_actor and reply_to is null) then raise exception 'invalid_reply'; end if;
   if nullif(p_data->>'event_id','') is not null and not exists(select 1 from platform_update_events where id=(p_data->>'event_id')::uuid and update_id=u.id) then raise exception 'invalid_event'; end if;
   insert into platform_update_comments(id,update_id,author_id,author_name,body,reply_to,event_id,revision) values(result_id,u.id,p_actor,left(p_name,120),p_data->>'body',parent_id,nullif(p_data->>'event_id','')::uuid,new_revision);
   if parent_id is not null then update platform_update_comments set feedback_status='answered' where id=parent_id; end if;
   update platform_updates set revision=new_revision,updated_at=now() where id=u.id;
  elsif p_action='feedback' then
   if p_data->>'feedback_status' not in ('received','handling') then raise exception 'invalid_status'; end if;
   update platform_update_comments set feedback_status=p_data->>'feedback_status' where id=(p_data->>'comment_id')::uuid and update_id=u.id and reply_to is null and author_id<>p_actor;
   if not found then raise exception 'not_found'; end if;
   update platform_updates set revision=new_revision,updated_at=now() where id=u.id;
  else raise exception 'invalid_action'; end if;
 end if;
 insert into security_audit_log(actor_user_id,action,object_type,object_id,metadata) values(p_actor,'platform_update.'||p_action,'platform_update',u.id::text,jsonb_build_object('revision',coalesce(new_revision,1)));
 return u.id;
end $$;
DO $$ declare t text; begin
 foreach t in array array['platform_updates','platform_update_events','platform_update_comments','platform_update_reads'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.mutate_platform_update(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_platform_update(uuid,text,text,uuid,jsonb) to service_role;

create function public.list_platform_updates(p_actor uuid,p_filter text,p_query text,p_offset integer,p_unread boolean default false)
returns table(id uuid,slug text,title text,summary text,body text,next_step text,status text,published boolean,category text,revision integer,created_at timestamptz,updated_at timestamptz,action_path text,action_label text,content_revision integer,unread boolean,total_count bigint)
language sql stable set search_path=public as $$
 select u.id,u.slug,u.title,u.summary,u.body,u.next_step,u.status,u.published,u.category,u.revision,u.created_at,u.updated_at,u.action_path,u.action_label,u.content_revision,u.revision>coalesce(r.revision,0),count(*) over() from platform_updates u left join platform_update_reads r on r.update_id=u.id and r.user_id=p_actor
 where exists(select 1 from user_roles where user_id=p_actor and role::text='super_admin')
 and u.published=(p_filter<>'drafts') and (not p_unread or u.revision>coalesce(r.revision,0))
 and (p_filter not in ('active','released','history') or (p_filter='active' and u.status in ('planned','in_progress','review','paused')) or (p_filter='released' and u.status='released') or (p_filter='history' and u.status='historical'))
 and (coalesce(p_query,'')='' or position(lower(p_query) in lower(u.title||' '||u.summary||' '||u.body))>0)
 order by case when u.status in ('planned','in_progress','review','paused') then 0 else 1 end,u.updated_at desc,u.id limit 12 offset greatest(0,p_offset)
$$;
revoke all on function public.list_platform_updates(uuid,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.list_platform_updates(uuid,text,text,integer,boolean) to service_role;
