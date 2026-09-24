-- Require an authenticated, confirmed MyGrowise customer for every new
-- accompaniment request. Historical guest bookings remain intact.

alter table public.bookings
  add column submission_key uuid;

alter table public.bookings
  drop constraint bookings_client_name_length,
  add constraint bookings_client_name_length check (char_length(client_name) between 2 and 120);

create unique index bookings_submission_key_unique_idx
  on public.bookings (submission_key)
  where submission_key is not null;

create table public.booking_status_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  request_id uuid,
  customer_visible boolean not null default true,
  constraint booking_status_events_transition check (from_status is null or from_status <> to_status)
);

create index booking_status_events_booking_time_idx
  on public.booking_status_events (booking_id, occurred_at, id);

alter table public.booking_status_events enable row level security;
revoke all on public.booking_status_events from public, anon, authenticated;
grant select on public.booking_status_events to service_role;

-- Record a minimal customer-visible status timeline. Never store a free-text
-- explanation here: status events are operational metadata, not clinical notes.
create function public.record_booking_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_request_id uuid;
begin
  if tg_op = 'INSERT' then
    v_request_id := nullif(current_setting('app.booking_request_id', true), '')::uuid;
    insert into public.booking_status_events
      (booking_id, from_status, to_status, actor_user_id, occurred_at, request_id, customer_visible)
    values
      (new.id, null, new.status, new.customer_user_id, new.created_at, v_request_id, true);
    return new;
  end if;

  if new.status is distinct from old.status then
    v_actor_user_id := nullif(current_setting('app.booking_actor_user_id', true), '')::uuid;
    v_request_id := nullif(current_setting('app.booking_request_id', true), '')::uuid;
    insert into public.booking_status_events
      (booking_id, from_status, to_status, actor_user_id, request_id, customer_visible)
    values
      (new.id, old.status, new.status, v_actor_user_id, v_request_id, true);
  end if;
  return new;
end;
$$;

create trigger bookings_record_status_event_after_insert
  after insert on public.bookings
  for each row execute function public.record_booking_status_event();

create trigger bookings_record_status_event_after_status_update
  after update of status on public.bookings
  for each row when (old.status is distinct from new.status)
  execute function public.record_booking_status_event();

revoke all on function public.record_booking_status_event() from public, anon, authenticated;

-- Do not manufacture status history for existing bookings: older rows only
-- retain their current status, not an authoritative transition log.

create function public.request_customer_booking(
  p_practitioner_slug text,
  p_customer_user_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_submission_key uuid,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user auth.users%rowtype;
  v_practitioner_id uuid;
  v_booking_id uuid;
  v_existing public.bookings%rowtype;
  v_name text;
  v_email text;
begin
  if p_customer_user_id is null or p_submission_key is null then
    raise exception 'Customer and submission key are required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.user_roles role
    where role.user_id = p_customer_user_id and role.role = 'customer'
  ) or exists (
    select 1 from public.user_roles role
    where role.user_id = p_customer_user_id
      and role.role in ('super_admin', 'support', 'employee', 'practitioner')
  ) then
    raise exception 'Customer account required' using errcode = '42501';
  end if;

  select auth_user.* into v_auth_user
  from auth.users auth_user
  where auth_user.id = p_customer_user_id;
  if not found or v_auth_user.email_confirmed_at is null then
    raise exception 'Confirmed customer email required' using errcode = '28000';
  end if;

  select practitioner.id into v_practitioner_id
  from public.practitioners practitioner
  join public.practitioner_settings settings on settings.practitioner_id = practitioner.id
  where lower(practitioner.slug) = lower(trim(p_practitioner_slug))
    and practitioner.active
    and settings.requests_enabled;
  if v_practitioner_id is null then
    raise exception 'Practitioner unavailable' using errcode = 'P0002';
  end if;

  select booking.* into v_existing
  from public.bookings booking
  where booking.submission_key = p_submission_key;
  if found then
    if v_existing.customer_user_id = p_customer_user_id
      and v_existing.practitioner_id = v_practitioner_id
      and v_existing.starts_at = p_starts_at
      and v_existing.ends_at = p_ends_at then
      return v_existing.id;
    end if;
    raise exception 'Submission key was already used' using errcode = '23505';
  end if;

  select coalesce(
      nullif(regexp_replace(trim(profile.full_name), '\s+', ' ', 'g'), ''),
      nullif(regexp_replace(trim(coalesce(v_auth_user.raw_user_meta_data ->> 'full_name', '')), '\s+', ' ', 'g'), '')
    ), lower(trim(v_auth_user.email))
  into v_name, v_email
  from (select 1) as seed
  left join public.profiles profile on profile.id = p_customer_user_id;

  if v_name is null or char_length(v_name) not between 2 and 120
    or v_email is null or char_length(v_email) not between 3 and 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Invalid customer or appointment details' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.get_bookable_slots(p_practitioner_slug, 90) slot
    where slot.starts_at = p_starts_at and slot.ends_at = p_ends_at
  ) then
    raise exception 'Requested slot is unavailable' using errcode = 'P0001';
  end if;

  begin
    perform set_config('app.booking_actor_user_id', p_customer_user_id::text, true);
    perform set_config('app.booking_request_id', coalesce(p_request_id::text, ''), true);
    insert into public.bookings
      (practitioner_id, customer_user_id, client_name, client_email, starts_at, ends_at, submission_key)
    values
      (v_practitioner_id, p_customer_user_id, v_name, v_email, p_starts_at, p_ends_at, p_submission_key)
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      raise exception 'Requested slot is unavailable' using errcode = 'P0001';
    when unique_violation then
      select booking.* into v_existing from public.bookings booking where booking.submission_key = p_submission_key;
      if found and v_existing.customer_user_id = p_customer_user_id
        and v_existing.practitioner_id = v_practitioner_id
        and v_existing.starts_at = p_starts_at and v_existing.ends_at = p_ends_at then
        return v_existing.id;
      end if;
      raise exception 'Submission key was already used' using errcode = '23505';
  end;

  insert into public.security_audit_log
    (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values
    (p_customer_user_id, 'booking.requested', 'booking', v_booking_id::text, p_request_id,
      '/api/bookings', jsonb_build_object('practitioner_id', v_practitioner_id));

  return v_booking_id;
end;
$$;

revoke all on function public.request_customer_booking(text, uuid, timestamptz, timestamptz, uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_customer_booking(text, uuid, timestamptz, timestamptz, uuid, uuid) to service_role;

create function public.transition_booking_status(
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_next_status public.booking_status,
  p_request_id uuid default null,
  p_request_path text default null
)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_can_manage_all boolean;
  v_owns_practitioner boolean;
begin
  select booking.* into v_booking
  from public.bookings booking
  where booking.id = p_booking_id
  for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;

  select exists (
    select 1 from public.user_roles role
    where role.user_id = p_actor_user_id and role.role in ('super_admin', 'support')
  ) into v_can_manage_all;
  select exists (
    select 1 from public.practitioners practitioner
    join public.user_roles role on role.user_id = practitioner.user_id and role.role = 'practitioner'
    where practitioner.id = v_booking.practitioner_id and practitioner.user_id = p_actor_user_id
  ) into v_owns_practitioner;
  if not v_can_manage_all and not v_owns_practitioner then
    raise exception 'Booking access denied' using errcode = '42501';
  end if;

  if not (
    (v_booking.status = 'pending' and p_next_status in ('confirmed', 'declined', 'cancelled'))
    or (v_booking.status = 'confirmed' and p_next_status in ('cancelled', 'completed', 'no_show'))
  ) then
    raise exception 'Invalid booking status transition' using errcode = '22023';
  end if;
  if v_booking.status = 'pending' and p_next_status = 'cancelled' and not v_can_manage_all then
    raise exception 'Only booking managers can cancel an unconfirmed request' using errcode = '42501';
  end if;

  perform set_config('app.booking_actor_user_id', p_actor_user_id::text, true);
  perform set_config('app.booking_request_id', coalesce(p_request_id::text, ''), true);

  update public.bookings
  set status = p_next_status,
      calendar_booked_at = case when p_next_status = 'confirmed' then now() else calendar_booked_at end
  where id = p_booking_id;

  insert into public.security_audit_log
    (actor_user_id, action, object_type, object_id, request_id, request_path, before_snapshot, after_snapshot, metadata)
  values
    (p_actor_user_id, 'booking.status_updated', 'booking', p_booking_id::text, p_request_id,
      left(coalesce(p_request_path, ''), 500),
      jsonb_build_object('status', v_booking.status, 'practitioner_id', v_booking.practitioner_id,
        'starts_at', v_booking.starts_at, 'ends_at', v_booking.ends_at),
      jsonb_build_object('status', p_next_status),
      jsonb_build_object('practitioner_id', v_booking.practitioner_id));

  return p_next_status;
end;
$$;

revoke all on function public.transition_booking_status(uuid, uuid, public.booking_status, uuid, text) from public, anon, authenticated;
grant execute on function public.transition_booking_status(uuid, uuid, public.booking_status, uuid, text) to service_role;

drop function public.cancel_customer_booking(uuid, uuid);
create function public.cancel_customer_booking(
  p_booking_id uuid,
  p_customer_id uuid,
  p_request_id uuid default null,
  p_request_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_notice_hours smallint;
begin
  select booking.* into v_booking
  from public.bookings booking
  where booking.id = p_booking_id and booking.customer_user_id = p_customer_id
  for update;
  if not found or v_booking.status not in ('pending', 'confirmed') then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.user_roles role where role.user_id = p_customer_id and role.role = 'customer'
  ) or exists (
    select 1 from public.user_roles role
    where role.user_id = p_customer_id and role.role in ('super_admin', 'support', 'employee', 'practitioner')
  ) then
    raise exception 'Customer account required' using errcode = '42501';
  end if;

  select settings.minimum_notice_hours into v_notice_hours
  from public.practitioner_settings settings
  where settings.practitioner_id = v_booking.practitioner_id;
  if v_booking.status = 'confirmed'
    and v_booking.starts_at < now() + make_interval(hours => coalesce(v_notice_hours, 2)) then
    raise exception 'Cancellation is too late' using errcode = 'P0001';
  end if;

  perform set_config('app.booking_actor_user_id', p_customer_id::text, true);
  perform set_config('app.booking_request_id', coalesce(p_request_id::text, ''), true);
  update public.bookings set status = 'cancelled' where id = p_booking_id;

  insert into public.security_audit_log
    (actor_user_id, action, object_type, object_id, request_id, request_path, before_snapshot, after_snapshot, metadata)
  values
    (p_customer_id, 'booking.cancelled_by_customer', 'booking', p_booking_id::text, p_request_id,
      left(coalesce(p_request_path, ''), 500), jsonb_build_object('status', v_booking.status),
      jsonb_build_object('status', 'cancelled'), jsonb_build_object('practitioner_id', v_booking.practitioner_id));
end;
$$;

revoke all on function public.cancel_customer_booking(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_customer_booking(uuid, uuid, uuid, text) to service_role;

-- The legacy request RPC accepted anonymous bookings. New writes go through
-- the authenticated Astro route and the service-only RPC above.
revoke all on function public.request_booking(text, text, text, timestamptz, timestamptz) from public, anon, authenticated, service_role;

-- Keep the dossier identity and booking identity in lockstep. Older guest
-- bookings and unlinked legacy dossiers can still be linked to each other
-- because both identity fields are null.
create function public.enforce_booking_patient_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_patient_customer_id uuid;
begin
  if new.patient_id is null then return new; end if;
  select patient.customer_user_id into v_patient_customer_id
  from public.patients patient where patient.id = new.patient_id;
  if not found or v_patient_customer_id is distinct from new.customer_user_id then
    raise exception 'Booking and client record accounts do not match' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger bookings_enforce_patient_identity
  before insert or update of patient_id, customer_user_id on public.bookings
  for each row execute function public.enforce_booking_patient_identity();

revoke all on function public.enforce_booking_patient_identity() from public, anon, authenticated;

-- A manually linked client is bound to the exact customer account. Existing
-- unlinked records can be adopted after the stored and verified booking emails
-- match; legacy guest bookings can still be linked without inventing an account.
create or replace function public.link_patient_booking(
  p_actor_user_id uuid,
  p_patient_id uuid,
  p_booking_id uuid,
  p_request_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_patient public.patients%rowtype;
  v_is_super_admin boolean;
  v_account_linked boolean := false;
begin
  select exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') into v_is_super_admin;
  select patient.* into v_patient
  from public.patients patient
  where patient.id = p_patient_id and patient.status = 'active'
  for update;
  if not found then raise exception 'patient_archived' using errcode = '22023'; end if;
  if not public.patient_actor_can_access(p_actor_user_id, p_patient_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not v_is_super_admin and not exists (
    select 1 from public.practitioners where id = v_booking.practitioner_id and user_id = p_actor_user_id
  ) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_booking.status not in ('confirmed', 'completed', 'no_show') then raise exception 'booking_not_ready' using errcode = '22023'; end if;

  if v_booking.customer_user_id is not null then
    if not exists (select 1 from public.user_roles where user_id = v_booking.customer_user_id and role = 'customer')
      or exists (select 1 from public.user_roles where user_id = v_booking.customer_user_id and role in ('super_admin', 'support', 'employee', 'practitioner'))
      or not exists (select 1 from auth.users where id = v_booking.customer_user_id and email_confirmed_at is not null) then
      raise exception 'booking_patient_mismatch' using errcode = '23514';
    end if;
    if v_patient.customer_user_id is not null and v_patient.customer_user_id <> v_booking.customer_user_id then
      raise exception 'booking_patient_mismatch' using errcode = '23514';
    end if;
    if v_patient.customer_user_id is null then
      -- A staff member may connect an existing dossier to a verified customer
      -- account only after the stored client email matches the booking email.
      if v_patient.email is null or lower(trim(v_patient.email)) <> lower(trim(v_booking.client_email)) then
        raise exception 'booking_patient_mismatch' using errcode = '23514';
      end if;
      begin
        update public.patients
        set customer_user_id = v_booking.customer_user_id
        where id = p_patient_id;
      exception when unique_violation then
        raise exception 'patient_account_already_linked' using errcode = '23505';
      end;
      v_account_linked := true;
    end if;
  elsif v_patient.customer_user_id is not null then
    raise exception 'booking_patient_mismatch' using errcode = '23514';
  elsif v_patient.email is not null then
    if lower(trim(v_patient.email)) <> lower(trim(v_booking.client_email)) then
      raise exception 'booking_patient_mismatch' using errcode = '23514';
    end if;
  elsif regexp_replace(lower(trim(v_patient.full_name)), '[[:space:]]+', ' ', 'g')
    <> regexp_replace(lower(trim(v_booking.client_name)), '[[:space:]]+', ' ', 'g') then
    raise exception 'booking_patient_mismatch' using errcode = '23514';
  end if;
  if v_booking.patient_id is not null and v_booking.patient_id <> p_patient_id then raise exception 'booking_already_linked' using errcode = '23505'; end if;
  update public.bookings set patient_id = p_patient_id where id = p_booking_id;
  update public.patients set updated_at = now() where id = p_patient_id;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, 'patient.booking_linked', 'booking', p_booking_id::text, p_request_id,
    '/api/admin/clienten/' || p_patient_id::text || '/afspraken',
    jsonb_build_object('patient_id', p_patient_id, 'customer_account_linked', v_account_linked));
end;
$$;

revoke all on function public.link_patient_booking(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_patient_booking(uuid, uuid, uuid, uuid) to service_role;
