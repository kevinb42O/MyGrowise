-- Itransform stays operationally separate from MyGrowise.  This small table
-- deliberately contains only scheduling metadata: no intake, diagnosis,
-- treatment, or free-form clinical notes belong in the shared admin product.

create table public.practice_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',
  event_kind text not null default 'appointment',
  location text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_calendar_events_title_length check (char_length(title) between 2 and 100),
  constraint practice_calendar_events_location_length check (char_length(location) <= 120),
  constraint practice_calendar_events_time_range check (starts_at < ends_at),
  constraint practice_calendar_events_status check (status in ('confirmed', 'cancelled')),
  constraint practice_calendar_events_kind check (event_kind in ('appointment', 'personal', 'block'))
);

create index practice_calendar_events_range_idx on public.practice_calendar_events (starts_at, ends_at);
create trigger practice_calendar_events_set_updated_at before update on public.practice_calendar_events for each row execute function public.set_updated_at();

alter table public.practice_calendar_events enable row level security;
create policy "practice calendar events: admin read" on public.practice_calendar_events for select to authenticated using (public.is_admin());
grant select on public.practice_calendar_events to authenticated;
