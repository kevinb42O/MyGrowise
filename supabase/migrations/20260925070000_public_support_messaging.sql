-- Practical support for guests and account customers, with durable mail jobs.
alter table public.support_conversations alter column customer_user_id drop not null;
alter table public.support_conversations
  add column guest_email text,
  add column guest_name text,
  add column guest_verified_at timestamptz,
  add column public_reference text,
  add column submission_key uuid;
alter table public.support_conversations
  add constraint support_owner_exactly_one check ((customer_user_id is null) <> (guest_email is null)),
  add constraint support_guest_email_valid check (guest_email is null or (char_length(guest_email) between 3 and 254 and guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  add constraint support_guest_name_valid check (guest_name is null or char_length(guest_name) between 1 and 100);
create unique index support_public_reference_unique on public.support_conversations(public_reference) where public_reference is not null;
create unique index support_submission_key_unique on public.support_conversations(submission_key) where submission_key is not null;
create index support_guest_email_idx on public.support_conversations(guest_email) where guest_email is not null;

alter table public.support_messages alter column sender_user_id drop not null;
alter table public.support_messages add column sender_type text not null default 'customer';
update public.support_messages message set sender_type = 'staff'
where exists (select 1 from public.user_roles role where role.user_id = message.sender_user_id and role.role in ('super_admin','admin','support'));
alter table public.support_messages add constraint support_message_sender_valid check (
  (sender_type = 'guest' and sender_user_id is null and not is_internal_note)
  or (sender_type in ('customer','staff') and sender_user_id is not null and (not is_internal_note or sender_type = 'staff'))
);

create table public.support_guest_tokens (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index support_guest_tokens_conversation_idx on public.support_guest_tokens(conversation_id, created_at desc);
create table public.support_guest_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index support_guest_sessions_conversation_idx on public.support_guest_sessions(conversation_id, expires_at);

create table public.support_mail_jobs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
  kind text not null check (kind in ('receipt','reply','access')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  constraint support_mail_jobs_attempts check (attempts between 0 and 20)
);
create unique index support_mail_jobs_message_unique on public.support_mail_jobs(message_id,kind) where message_id is not null;
create index support_mail_jobs_pending_idx on public.support_mail_jobs(status,next_attempt_at);

create table public.support_rate_limits (
  key_hash text primary key,
  count integer not null,
  reset_at timestamptz not null
);

create or replace function public.support_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if char_length(p_key_hash) <> 64 or p_limit not between 1 and 100 or p_window_seconds not between 60 and 86400 then return false; end if;
  insert into public.support_rate_limits(key_hash,count,reset_at) values (p_key_hash,1,now()+make_interval(secs=>p_window_seconds))
  on conflict (key_hash) do update set
    count = case when public.support_rate_limits.reset_at <= now() then 1 else public.support_rate_limits.count+1 end,
    reset_at = case when public.support_rate_limits.reset_at <= now() then now()+make_interval(secs=>p_window_seconds) else public.support_rate_limits.reset_at end
  returning count into v_count;
  return v_count <= p_limit;
end; $$;

create or replace function public.create_guest_support_conversation(
  p_email text,p_name text,p_category text,p_body text,p_submission_key uuid
) returns table(conversation_id uuid, reference text)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_reference text; v_message_id uuid;
begin
  if p_submission_key is null or p_email is null or char_length(p_email) not between 3 and 254
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or p_name is null or char_length(p_name) not between 1 and 100
    or p_category not in ('general','order','access','booking','privacy','other','collaboration')
    or p_body is null or char_length(p_body) not between 1 and 4000 then
    raise exception 'Invalid support input' using errcode = '22023';
  end if;
  select id, public_reference into v_id,v_reference from public.support_conversations where submission_key = p_submission_key;
  if found then return query select v_id,v_reference; return; end if;
  v_reference := upper(encode(gen_random_bytes(5),'hex'));
  insert into public.support_conversations(guest_email,guest_name,subject,category,public_reference,submission_key)
  values(lower(trim(p_email)),trim(p_name),'Vraag ' || v_reference,p_category,v_reference,p_submission_key)
  returning id into v_id;
  insert into public.support_messages(conversation_id,sender_user_id,sender_type,body)
  values(v_id,null,'guest',p_body) returning id into v_message_id;
  insert into public.support_mail_jobs(conversation_id,message_id,kind) values(v_id,v_message_id,'receipt');
  return query select v_id,v_reference;
end; $$;

create or replace function public.create_customer_support_conversation(
  p_customer_id uuid,p_subject text,p_category text,p_body text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_customer_id is null or p_subject is null or char_length(p_subject) not between 2 and 180
    or p_category not in ('general','order','access','booking','privacy','other','collaboration')
    or p_body is null or char_length(p_body) not between 1 and 4000 then
    raise exception 'Invalid support input' using errcode = '22023';
  end if;
  insert into public.support_conversations(customer_user_id,subject,category) values(p_customer_id,p_subject,p_category) returning id into v_id;
  insert into public.support_messages(conversation_id,sender_user_id,sender_type,body) values(v_id,p_customer_id,'customer',p_body);
  return v_id;
end; $$;

create function public.claim_guest_support_conversation(p_id uuid,p_customer_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  select lower(email) into v_email from auth.users where id=p_customer_id and email_confirmed_at is not null;
  if v_email is null or not exists (
    select 1 from public.user_roles where user_id=p_customer_id and role='customer'
  ) or exists (
    select 1 from public.user_roles where user_id=p_customer_id and role in ('super_admin','admin','support','employee','practitioner')
  ) then return false; end if;
  update public.support_conversations set customer_user_id=p_customer_id,guest_email=null
  where id=p_id and lower(guest_email)=v_email and guest_verified_at is not null;
  if not found then return false; end if;
  update public.support_messages set sender_user_id=p_customer_id,sender_type='customer'
  where conversation_id=p_id and sender_type='guest';
  delete from public.support_guest_sessions where conversation_id=p_id;
  delete from public.support_guest_tokens where conversation_id=p_id;
  return true;
end; $$;

create function public.count_unread_support_conversations(p_customer_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.support_conversations conversation
  where conversation.customer_user_id=p_customer_id
    and exists (select 1 from public.support_messages message
      where message.conversation_id=conversation.id and message.sender_type='staff'
        and not message.is_internal_note and (conversation.customer_last_read_at is null or message.created_at > conversation.customer_last_read_at));
$$;

alter table public.support_conversations drop constraint support_conversations_category;
alter table public.support_conversations add constraint support_conversations_category check (category in ('general','order','access','booking','privacy','other','collaboration'));

create or replace function public.touch_support_conversation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_internal_note then return new; end if;
  update public.support_conversations set
    last_message_at = new.created_at,
    updated_at = now(),
    customer_last_read_at = case when new.sender_type = 'staff' then customer_last_read_at else new.created_at end,
    staff_last_read_at = case when new.sender_type = 'staff' then new.created_at else staff_last_read_at end,
    status = case when new.sender_type = 'staff' then 'waiting_customer'
      when status in ('resolved','closed') then 'new' else 'in_progress' end
  where id = new.conversation_id;
  return new;
end; $$;

create or replace function public.notify_support_staff()
returns trigger language plpgsql set search_path = '' as $$
declare v_subject text; v_assignee uuid;
begin
  if new.is_internal_note or new.sender_type = 'staff' then return new; end if;
  select subject,assigned_to into v_subject,v_assignee from public.support_conversations where id=new.conversation_id;
  insert into public.internal_notifications(recipient_user_id,notification_type,support_conversation_id,title)
  select role.user_id,'support_message',new.conversation_id,'Klantvraag · ' || v_subject
  from public.user_roles role
  where role.role in ('super_admin','admin','support')
    and (new.sender_user_id is null or role.user_id <> new.sender_user_id)
    and (v_assignee is null or role.user_id = v_assignee)
  on conflict do nothing;
  return new;
end; $$;

create function public.queue_support_reply_mail()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sender_type = 'staff' and not new.is_internal_note then
    insert into public.support_mail_jobs(conversation_id,message_id,kind) values(new.conversation_id,new.id,'reply') on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger support_messages_queue_reply after insert on public.support_messages
  for each row execute function public.queue_support_reply_mail();

create function public.claim_support_mail_jobs(p_limit integer)
returns setof public.support_mail_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select id from public.support_mail_jobs
    where (status = 'pending' and next_attempt_at <= now()) or (status = 'sending' and lease_until < now())
    order by created_at limit least(greatest(p_limit,1),20) for update skip locked
  ) update public.support_mail_jobs job set status='sending',attempts=job.attempts+1,lease_until=now()+interval '2 minutes'
  from picked where job.id=picked.id returning job.*;
end; $$;

alter table public.support_guest_tokens enable row level security;
alter table public.support_guest_sessions enable row level security;
alter table public.support_mail_jobs enable row level security;
alter table public.support_rate_limits enable row level security;
revoke all on public.support_guest_tokens,public.support_guest_sessions,public.support_mail_jobs,public.support_rate_limits from anon,authenticated;
revoke all on function public.support_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.create_guest_support_conversation(text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.create_customer_support_conversation(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_guest_support_conversation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.count_unread_support_conversations(uuid) from public,anon,authenticated;
revoke all on function public.claim_support_mail_jobs(integer) from public,anon,authenticated;
grant execute on function public.support_rate_limit(text,integer,integer),public.create_guest_support_conversation(text,text,text,text,uuid),public.create_customer_support_conversation(uuid,text,text,text),public.claim_guest_support_conversation(uuid,uuid),public.count_unread_support_conversations(uuid),public.claim_support_mail_jobs(integer) to service_role;
