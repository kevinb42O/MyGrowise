-- An earlier migration version is recorded in some databases without these
-- columns. Apply the final calendar shape idempotently to both histories.
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
language plpgsql
security definer
set search_path = ''
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

  -- All three writers use this lock before checking the other tables. The
  -- bookings exclusion constraint remains the final booking/booking guard.
  perform pg_advisory_xact_lock(hashtextextended(new.practitioner_id::text, 0));
  v_range := tstzrange(new.starts_at, new.ends_at, '[)');

  if tg_table_name <> 'bookings' and exists (
    select 1 from public.bookings b
    where b.practitioner_id = new.practitioner_id
      and b.status in ('pending', 'confirmed')
      and b.time_range && v_range
  ) then
    raise exception 'Time conflicts with a booking' using errcode = '23P01';
  end if;

  if tg_table_name <> 'availability_exceptions' and exists (
    select 1 from public.availability_exceptions e
    where e.practitioner_id = new.practitioner_id
      and e.kind = 'unavailable' and tstzrange(e.starts_at, e.ends_at, '[)') && v_range
  ) then
    raise exception 'Time conflicts with a block' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.practice_calendar_events e
    where e.practitioner_id = new.practitioner_id
      and (tg_table_name <> 'practice_calendar_events' or e.id <> new.id)
      and e.status = 'confirmed' and tstzrange(e.starts_at, e.ends_at, '[)') && v_range
  ) then
    raise exception 'Time conflicts with an assigned event' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_enforce_schedule on public.bookings;
create trigger bookings_enforce_schedule
  before insert or update of practitioner_id, starts_at, ends_at, status on public.bookings
  for each row execute function public.enforce_practitioner_schedule();
drop trigger if exists availability_exceptions_enforce_schedule on public.availability_exceptions;
create trigger availability_exceptions_enforce_schedule
  before insert or update of practitioner_id, starts_at, ends_at, kind on public.availability_exceptions
  for each row execute function public.enforce_practitioner_schedule();
drop trigger if exists practice_calendar_events_enforce_schedule on public.practice_calendar_events;
create trigger practice_calendar_events_enforce_schedule
  before insert or update of practitioner_id, starts_at, ends_at, status on public.practice_calendar_events
  for each row execute function public.enforce_practitioner_schedule();
revoke all on function public.enforce_practitioner_schedule() from public, anon, authenticated;

create or replace function public.get_bookable_slots(p_practitioner_slug text, p_days integer default 14)
returns table (practitioner_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with selected_practitioner as (
    select p.id, s.appointment_duration_minutes, s.minimum_notice_hours, s.booking_horizon_days
    from public.practitioners p
    join public.practitioner_settings s on s.practitioner_id = p.id
    where p.slug = lower(trim(p_practitioner_slug)) and p.active and s.requests_enabled
  ), candidate_slots as (
    select p.id as practitioner_id,
      ((day.local_day + rule.start_time) at time zone 'Europe/Brussels')
        + (step.slot_number * make_interval(mins => p.appointment_duration_minutes)) as starts_at,
      ((day.local_day + rule.start_time) at time zone 'Europe/Brussels')
        + ((step.slot_number + 1) * make_interval(mins => p.appointment_duration_minutes)) as ends_at
    from selected_practitioner p
    join public.availability_rules rule on rule.practitioner_id = p.id
    cross join lateral generate_series(
      timezone('Europe/Brussels', now())::date,
      timezone('Europe/Brussels', now())::date + least(greatest(coalesce(p_days, 14), 1), p.booking_horizon_days),
      interval '1 day'
    ) as day_value
    cross join lateral (select day_value::date as local_day) day
    cross join lateral generate_series(
      0, floor(extract(epoch from (rule.end_time - rule.start_time)) / 60 / p.appointment_duration_minutes)::integer - 1
    ) as step(slot_number)
    where extract(isodow from day.local_day) = rule.weekday
  )
  select candidate.practitioner_id, candidate.starts_at, candidate.ends_at
  from candidate_slots candidate
  join selected_practitioner p on p.id = candidate.practitioner_id
  where candidate.starts_at >= now() + make_interval(hours => p.minimum_notice_hours)
    and not exists (
      select 1 from public.availability_exceptions e
      where e.practitioner_id = candidate.practitioner_id and e.kind = 'unavailable'
        and tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(candidate.starts_at, candidate.ends_at, '[)')
    )
    and not exists (
      select 1 from public.bookings b
      where b.practitioner_id = candidate.practitioner_id and b.status in ('pending', 'confirmed')
        and b.time_range && tstzrange(candidate.starts_at, candidate.ends_at, '[)')
    )
    and not exists (
      select 1 from public.practice_calendar_events e
      where e.practitioner_id = candidate.practitioner_id and e.status = 'confirmed'
        and tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(candidate.starts_at, candidate.ends_at, '[)')
    )
  order by candidate.starts_at;
$$;
