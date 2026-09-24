-- Internal staff communication. This deliberately stays separate from customer
-- support and clinical records: no customer fields, intake content, or session notes.

create type public.internal_notification_type as enum ('internal_message');

create table public.internal_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint internal_threads_subject_length check (char_length(subject) between 2 and 180)
);
create index internal_threads_last_message_idx on public.internal_threads (last_message_at desc);

create table public.internal_thread_participants (
  thread_id uuid not null references public.internal_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);
create index internal_thread_participants_user_idx on public.internal_thread_participants (user_id, thread_id);

create table public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.internal_threads(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  constraint internal_messages_body_length check (char_length(body) between 1 and 4000)
);
create index internal_messages_thread_idx on public.internal_messages (thread_id, created_at);

create table public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type public.internal_notification_type not null,
  thread_id uuid references public.internal_threads(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint internal_notifications_title_length check (char_length(title) between 2 and 180)
);
create index internal_notifications_unread_idx on public.internal_notifications (recipient_user_id, created_at desc) where read_at is null;

create function public.is_internal_thread_participant(p_thread_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.internal_thread_participants
    where thread_id = p_thread_id and user_id = p_user_id
  );
$$;

create function public.touch_internal_thread()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.internal_threads
  set last_message_at = new.created_at, updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

create function public.notify_internal_thread_participants()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  thread_subject text;
begin
  select subject into thread_subject from public.internal_threads where id = new.thread_id;
  insert into public.internal_notifications (recipient_user_id, notification_type, thread_id, title)
  select participant.user_id, 'internal_message', new.thread_id, thread_subject
  from public.internal_thread_participants participant
  where participant.thread_id = new.thread_id and participant.user_id <> new.sender_user_id;
  return new;
end;
$$;

create trigger internal_messages_touch_thread after insert on public.internal_messages
  for each row execute function public.touch_internal_thread();
create trigger internal_messages_notify_participants after insert on public.internal_messages
  for each row execute function public.notify_internal_thread_participants();

alter table public.internal_threads enable row level security;
alter table public.internal_thread_participants enable row level security;
alter table public.internal_messages enable row level security;
alter table public.internal_notifications enable row level security;

create policy "internal threads: participants read" on public.internal_threads for select to authenticated using (public.is_internal_thread_participant(id));
create policy "internal participants: own threads read" on public.internal_thread_participants for select to authenticated using (
  public.is_internal_thread_participant(thread_id)
);
create policy "internal messages: participants read" on public.internal_messages for select to authenticated using (
  public.is_internal_thread_participant(thread_id)
);
create policy "internal notifications: recipient read" on public.internal_notifications for select to authenticated using (recipient_user_id = auth.uid());

grant select on public.internal_threads, public.internal_thread_participants, public.internal_messages, public.internal_notifications to authenticated;
