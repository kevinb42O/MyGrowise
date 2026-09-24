-- Customer support is intentionally separate from internal team conversations.
-- It holds practical support only; client records, assessments and clinical notes
-- are not part of this inbox.

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null,
  category text not null default 'general',
  status text not null default 'new',
  priority text not null default 'normal',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  customer_last_read_at timestamptz,
  staff_last_read_at timestamptz,
  constraint support_conversations_subject_length check (char_length(subject) between 2 and 180),
  constraint support_conversations_category check (category in ('general', 'order', 'access', 'booking', 'privacy', 'other')),
  constraint support_conversations_status check (status in ('new', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  constraint support_conversations_priority check (priority in ('low', 'normal', 'high', 'urgent'))
);
create index support_conversations_queue_idx on public.support_conversations (status, priority, last_message_at desc);
create index support_conversations_customer_idx on public.support_conversations (customer_user_id, last_message_at desc);
create index support_conversations_assignee_idx on public.support_conversations (assigned_to, last_message_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now(),
  constraint support_messages_body_length check (char_length(body) between 1 and 4000)
);
create index support_messages_conversation_idx on public.support_messages (conversation_id, created_at);

alter table public.internal_notifications
  add column support_conversation_id uuid references public.support_conversations(id) on delete cascade;
create index internal_notifications_support_idx on public.internal_notifications (support_conversation_id) where support_conversation_id is not null;

create function public.is_support_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role in ('super_admin', 'admin', 'support')
  );
$$;

create function public.touch_support_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_staff boolean;
begin
  v_is_staff := public.is_support_staff(new.sender_user_id);
  update public.support_conversations
  set last_message_at = new.created_at,
      updated_at = now(),
      customer_last_read_at = case when v_is_staff then customer_last_read_at else new.created_at end,
      staff_last_read_at = case when v_is_staff then new.created_at else staff_last_read_at end,
      status = case
        when new.is_internal_note then status
        when v_is_staff then 'waiting_customer'
        when status in ('resolved', 'closed') then 'new'
        else 'in_progress'
      end
  where id = new.conversation_id;
  return new;
end;
$$;

create function public.notify_support_staff()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_subject text;
  v_assignee uuid;
begin
  if new.is_internal_note or public.is_support_staff(new.sender_user_id) then return new; end if;
  select subject, assigned_to into v_subject, v_assignee from public.support_conversations where id = new.conversation_id;
  insert into public.internal_notifications (recipient_user_id, notification_type, support_conversation_id, title)
  select role.user_id, 'support_message', new.conversation_id, 'Klantvraag · ' || v_subject
  from public.user_roles role
  where role.role in ('super_admin', 'admin', 'support')
    and role.user_id <> new.sender_user_id
    and (v_assignee is null or role.user_id = v_assignee)
  on conflict do nothing;
  return new;
end;
$$;

create trigger support_conversations_set_updated_at before update on public.support_conversations
  for each row execute function public.set_updated_at();
create trigger support_messages_touch_conversation after insert on public.support_messages
  for each row execute function public.touch_support_conversation();
create trigger support_messages_notify_staff after insert on public.support_messages
  for each row execute function public.notify_support_staff();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
create policy "support conversations: customer read own" on public.support_conversations for select to authenticated using (customer_user_id = auth.uid() or public.is_support_staff());
create policy "support messages: customer read visible own" on public.support_messages for select to authenticated using (
  public.is_support_staff() or (not is_internal_note and exists (select 1 from public.support_conversations where id = conversation_id and customer_user_id = auth.uid()))
);
grant select on public.support_conversations, public.support_messages to authenticated;
grant execute on function public.is_support_staff(uuid) to authenticated, service_role;
