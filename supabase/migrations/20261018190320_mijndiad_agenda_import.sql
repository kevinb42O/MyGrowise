-- Imported busy blocks retain their source identity and cannot be edited by
-- the application. Only the explicit, transaction-scoped operator import writes them.
alter table public.practice_calendar_events
  add column external_source text,
  add column external_uid text,
  add constraint practice_calendar_external_identity check (
    (external_source is null and external_uid is null) or
    (external_source is not null and external_source = 'mijndiad' and external_uid is not null
      and external_uid ~ '^[0-9a-f]{64}$'
      and calendar_scope = 'itransform' and practitioner_id is not null)
  );
create unique index practice_calendar_external_uid_idx
  on public.practice_calendar_events(practitioner_id, external_source, external_uid)
  where external_source is not null;

-- External practice occupancy is served only through the owner-scoped server
-- endpoint, never the generic administrative table-read policy.
alter policy "practice calendar events: admin read" on public.practice_calendar_events
  using (public.is_admin() and external_source is null);

create function public.guard_imported_calendar_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_op <> 'INSERT' and old.external_source is not null)
    or (tg_op <> 'DELETE' and new.external_source is not null) then
    if current_user <> 'postgres'
      or current_setting('mygrowise.mijndiad_import', true) is distinct from 'on' then
      raise exception 'Imported calendar events are read-only' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_imported_calendar_event() from public, anon, authenticated;
create trigger practice_calendar_events_00_guard_import
  before insert or update or delete on public.practice_calendar_events
  for each row execute function public.guard_imported_calendar_event();

create or replace function public.enforce_practitioner_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_range tstzrange;
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
  -- External appointments already exist. Preserve overlaps for review instead
  -- of dropping them. The invoker guard separately restricts all import writes.
  if tg_table_name = 'practice_calendar_events' then
    if new.external_source = 'mijndiad'
      and current_setting('mygrowise.mijndiad_import', true) = 'on' then
      return new;
    end if;
  end if;
  v_range := tstzrange(new.starts_at, new.ends_at, '[)');
  if tg_table_name <> 'bookings' and exists (
    select 1 from public.bookings b where b.practitioner_id = new.practitioner_id
      and b.status in ('pending', 'confirmed') and b.time_range && v_range
  ) then raise exception 'Time conflicts with a booking' using errcode = '23P01'; end if;
  if tg_table_name <> 'availability_exceptions' and exists (
    select 1 from public.availability_exceptions e where e.practitioner_id = new.practitioner_id
      and e.kind = 'unavailable' and tstzrange(e.starts_at, e.ends_at, '[)') && v_range
  ) then raise exception 'Time conflicts with a block' using errcode = '23P01'; end if;
  if exists (
    select 1 from public.practice_calendar_events e where e.practitioner_id = new.practitioner_id
      and (tg_table_name <> 'practice_calendar_events' or e.id <> new.id)
      and e.status = 'confirmed' and tstzrange(e.starts_at, e.ends_at, '[)') && v_range
  ) then raise exception 'Time conflicts with an assigned event' using errcode = '23P01'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_practitioner_schedule() from public, anon, authenticated;
