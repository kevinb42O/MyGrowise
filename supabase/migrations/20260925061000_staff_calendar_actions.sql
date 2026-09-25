-- Staff-created appointments share the bookings table and conflict rules with
-- customer requests. Reschedules keep the original booking identity.
-- The analytics migration already owns version 20260925060000. Install the
-- calendar columns here before defining functions that use them.
alter table public.practice_calendar_events
  add column if not exists practitioner_id uuid references public.practitioners(id) on delete set null;
create index if not exists practice_calendar_events_practitioner_range_idx
  on public.practice_calendar_events (practitioner_id, starts_at, ends_at)
  where practitioner_id is not null and status = 'confirmed';
alter table public.bookings
  add column if not exists origin text not null default 'customer_request';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_origin_check') then
    alter table public.bookings add constraint bookings_origin_check
      check (origin in ('customer_request', 'staff'));
  end if;
end $$;

create or replace function public.enforce_practitioner_schedule()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_range tstzrange;
begin
  if new.practitioner_id is null then return new; end if;
  if tg_table_name = 'bookings' then
    if new.status not in ('pending', 'confirmed') then return new; end if;
  elsif tg_table_name = 'availability_exceptions' then
    if new.kind <> 'unavailable' then return new; end if;
  elsif tg_table_name = 'practice_calendar_events' then
    if new.status <> 'confirmed' then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.practitioner_id::text, 0));
  v_range := tstzrange(new.starts_at, new.ends_at, '[)');
  if tg_table_name <> 'bookings' and exists (
    select 1 from public.bookings b
    where b.practitioner_id = new.practitioner_id
      and b.status in ('pending', 'confirmed') and b.time_range && v_range
  ) then raise exception 'Time conflicts with a booking' using errcode = '23P01'; end if;
  if tg_table_name <> 'availability_exceptions' and exists (
    select 1 from public.availability_exceptions e
    where e.practitioner_id = new.practitioner_id and e.kind = 'unavailable'
      and tstzrange(e.starts_at, e.ends_at, '[)') && v_range
  ) then raise exception 'Time conflicts with a block' using errcode = '23P01'; end if;
  if exists (
    select 1 from public.practice_calendar_events e
    where e.practitioner_id = new.practitioner_id
      and (tg_table_name <> 'practice_calendar_events' or e.id <> new.id)
      and e.status = 'confirmed' and tstzrange(e.starts_at, e.ends_at, '[)') && v_range
  ) then raise exception 'Time conflicts with an assigned event' using errcode = '23P01'; end if;
  return new;
end;
$$;

create function public.create_staff_booking(
  p_practitioner_id uuid, p_actor_user_id uuid, p_patient_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz, p_request_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient public.patients%rowtype;
  v_booking_id uuid;
begin
  if not exists (
    select 1 from public.practitioners p
    join public.user_roles r on r.user_id = p.user_id and r.role = 'practitioner'
    where p.id = p_practitioner_id and p.user_id = p_actor_user_id
  ) then raise exception 'Practitioner access denied' using errcode = '42501'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at <= now()
    or p_ends_at <= p_starts_at or p_ends_at - p_starts_at > interval '4 hours' then
    raise exception 'Invalid appointment time' using errcode = '22023';
  end if;
  select patient.* into v_patient from public.patients patient
  join public.patient_assignments a on a.patient_id = patient.id
    and a.user_id = p_actor_user_id and a.ended_at is null
  where patient.id = p_patient_id and patient.status = 'active';
  if not found then raise exception 'Patient access denied' using errcode = '42501'; end if;
  if v_patient.email is null or v_patient.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Patient email required' using errcode = '22023';
  end if;

  perform set_config('app.booking_actor_user_id', p_actor_user_id::text, true);
  perform set_config('app.booking_request_id', coalesce(p_request_id::text, ''), true);
  insert into public.bookings
    (practitioner_id, patient_id, customer_user_id, client_name, client_email,
     starts_at, ends_at, status, origin, calendar_booked_at)
  values
    (p_practitioner_id, p_patient_id, v_patient.customer_user_id, v_patient.full_name,
     lower(trim(v_patient.email)), p_starts_at, p_ends_at, 'confirmed', 'staff', now())
  returning id into v_booking_id;

  insert into public.security_audit_log
    (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values
    (p_actor_user_id, 'booking.created_by_staff', 'booking', v_booking_id::text,
     p_request_id, '/api/praktijk/agenda', jsonb_build_object('practitioner_id', p_practitioner_id));
  return v_booking_id;
end;
$$;
revoke all on function public.create_staff_booking(uuid, uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.create_staff_booking(uuid, uuid, uuid, timestamptz, timestamptz, uuid) to service_role;

create or replace function public.create_customer_booking_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.customer_visible then return new; end if;
  if new.from_status is null and not exists (
    select 1 from public.bookings b where b.id = new.booking_id and b.origin = 'staff'
  ) then return new; end if;
  insert into public.customer_notifications
    (customer_user_id, booking_id, status_event_id, created_at)
  select b.customer_user_id, b.id, new.id, new.occurred_at
  from public.bookings b
  where b.id = new.booking_id and b.customer_user_id is not null
    and (new.from_status is null or new.actor_user_id is distinct from b.customer_user_id)
  on conflict (status_event_id) do nothing;
  return new;
end;
$$;

create table public.booking_schedule_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  old_starts_at timestamptz not null,
  old_ends_at timestamptz not null,
  new_starts_at timestamptz not null,
  new_ends_at timestamptz not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index booking_schedule_events_booking_idx on public.booking_schedule_events (booking_id, occurred_at desc);
alter table public.booking_schedule_events enable row level security;
revoke all on public.booking_schedule_events from public, anon, authenticated;
grant select on public.booking_schedule_events to service_role;

alter table public.customer_notifications alter column status_event_id drop not null;
alter table public.customer_notifications add column schedule_event_id bigint unique
  references public.booking_schedule_events(id) on delete cascade;
alter table public.customer_notifications add constraint customer_notifications_one_event_check
  check ((status_event_id is not null) <> (schedule_event_id is not null));

create function public.reschedule_staff_booking(
  p_booking_id uuid, p_actor_user_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz, p_request_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_event_id bigint;
begin
  select b.* into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.practitioners p
    join public.user_roles r on r.user_id = p.user_id and r.role = 'practitioner'
    where p.id = v_booking.practitioner_id and p.user_id = p_actor_user_id
  ) then raise exception 'Booking access denied' using errcode = '42501'; end if;
  if v_booking.status <> 'confirmed' or v_booking.starts_at <= now()
    or p_starts_at is null or p_ends_at is null or p_starts_at <= now()
    or p_ends_at <= p_starts_at or p_ends_at - p_starts_at > interval '4 hours'
    or (v_booking.starts_at = p_starts_at and v_booking.ends_at = p_ends_at) then
    raise exception 'Invalid reschedule' using errcode = '22023';
  end if;

  update public.bookings set starts_at = p_starts_at, ends_at = p_ends_at where id = p_booking_id;
  insert into public.booking_schedule_events
    (booking_id, old_starts_at, old_ends_at, new_starts_at, new_ends_at, actor_user_id)
  values (p_booking_id, v_booking.starts_at, v_booking.ends_at, p_starts_at, p_ends_at, p_actor_user_id)
  returning id into v_event_id;
  if v_booking.customer_user_id is not null then
    insert into public.customer_notifications (customer_user_id, booking_id, schedule_event_id)
    values (v_booking.customer_user_id, p_booking_id, v_event_id);
  end if;
  insert into public.security_audit_log
    (actor_user_id, action, object_type, object_id, request_id, request_path, before_snapshot, after_snapshot)
  values
    (p_actor_user_id, 'booking.rescheduled', 'booking', p_booking_id::text, p_request_id,
     '/api/praktijk/agenda', jsonb_build_object('starts_at', v_booking.starts_at, 'ends_at', v_booking.ends_at),
     jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at));
end;
$$;
revoke all on function public.reschedule_staff_booking(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.reschedule_staff_booking(uuid, uuid, timestamptz, timestamptz, uuid) to service_role;

create function public.enforce_booking_status_time()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'pending' and new.status = 'confirmed' and new.starts_at <= now() then
    raise exception 'Past requests cannot be confirmed' using errcode = '22023';
  end if;
  if old.status = 'confirmed' and new.status = 'completed' and new.ends_at > now() then
    raise exception 'Future appointments cannot be completed' using errcode = '22023';
  end if;
  if old.status = 'confirmed' and new.status = 'no_show' and new.starts_at > now() then
    raise exception 'Future appointments cannot be marked no-show' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger bookings_enforce_status_time
  before update of status on public.bookings
  for each row when (old.status is distinct from new.status)
  execute function public.enforce_booking_status_time();
revoke all on function public.enforce_booking_status_time() from public, anon, authenticated;
