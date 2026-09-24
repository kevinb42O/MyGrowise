-- Private client records for care work. Client identities are independent from
-- shop accounts; customer_user_id is an optional, exact identity link.
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  customer_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint patients_full_name_length check (char_length(trim(full_name)) between 2 and 120),
  constraint patients_email_length check (email is null or char_length(email) between 3 and 254),
  constraint patients_status check (status in ('active', 'archived')),
  constraint patients_archive_timestamp check ((status = 'archived') = (archived_at is not null))
);
create unique index patients_customer_user_unique_idx on public.patients (customer_user_id) where customer_user_id is not null;
create index patients_name_idx on public.patients (lower(full_name));
create index patients_updated_idx on public.patients (updated_at desc);
create trigger patients_set_updated_at before update on public.patients
  for each row execute function public.set_updated_at();

create table public.patient_assignments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  constraint patient_assignments_end_pair check (ended_at is not null or ended_by is null)
);
create unique index patient_assignments_active_unique_idx on public.patient_assignments (patient_id, user_id) where ended_at is null;
create index patient_assignments_user_active_idx on public.patient_assignments (user_id, patient_id) where ended_at is null;
create index patient_assignments_patient_idx on public.patient_assignments (patient_id, assigned_at desc);

alter table public.bookings
  add column patient_id uuid references public.patients(id) on delete set null;
create index bookings_patient_start_idx on public.bookings (patient_id, starts_at desc) where patient_id is not null;

create table public.patient_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  note_type text not null default 'session',
  occurred_at timestamptz not null default now(),
  status text not null default 'draft',
  current_version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id) on delete set null,
  corrects_note_id uuid references public.patient_notes(id) on delete set null,
  constraint patient_notes_type check (note_type in ('intake', 'session', 'follow_up', 'other', 'correction')),
  constraint patient_notes_status check (status in ('draft', 'final')),
  constraint patient_notes_version_positive check (current_version > 0),
  constraint patient_notes_finalization check ((status = 'final') = (finalized_at is not null)),
  constraint patient_notes_correction_type check ((corrects_note_id is null) or note_type = 'correction'),
  constraint patient_notes_not_self_correction check (corrects_note_id is null or corrects_note_id <> id)
);
create index patient_notes_patient_occurred_idx on public.patient_notes (patient_id, occurred_at desc, created_at desc);
create index patient_notes_booking_idx on public.patient_notes (booking_id) where booking_id is not null;
create index patient_notes_correction_idx on public.patient_notes (corrects_note_id) where corrects_note_id is not null;
create trigger patient_notes_set_updated_at before update on public.patient_notes
  for each row execute function public.set_updated_at();

create function public.prevent_final_patient_note_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status = 'final' then raise exception 'final_note_is_immutable' using errcode = '55000'; end if;
  return new;
end;
$$;
create trigger patient_notes_final_immutable before update on public.patient_notes
  for each row execute function public.prevent_final_patient_note_update();

-- Content is revisioned in append-only rows. The application only creates new
-- versions; finalized notes are immutable and can be corrected by a new note.
create table public.patient_note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.patient_notes(id) on delete cascade,
  version_number integer not null,
  title text not null,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint patient_note_versions_number_positive check (version_number > 0),
  constraint patient_note_versions_title_length check (char_length(trim(title)) between 2 and 120),
  constraint patient_note_versions_body_length check (char_length(trim(body)) between 1 and 20000),
  unique (note_id, version_number)
);
create index patient_note_versions_note_idx on public.patient_note_versions (note_id, version_number desc);

create function public.prevent_patient_note_version_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'patient_note_versions_are_immutable' using errcode = '55000';
end;
$$;
create trigger patient_note_versions_immutable before update on public.patient_note_versions
  for each row execute function public.prevent_patient_note_version_update();

create view public.patient_notes_current as
select note.id, note.patient_id, note.booking_id, note.note_type, note.occurred_at,
  note.status, note.current_version, note.created_by, note.created_at, note.updated_at,
  note.finalized_at, note.finalized_by, note.corrects_note_id,
  version.title, version.body, version.created_at as version_created_at
from public.patient_notes as note
join public.patient_note_versions as version
  on version.note_id = note.id and version.version_number = note.current_version;

create view public.patient_note_statistics as
select patient_id, count(*)::bigint as note_count, max(occurred_at) as latest_note_at
from public.patient_notes
group by patient_id;

alter table public.patients enable row level security;
alter table public.patient_assignments enable row level security;
alter table public.patient_notes enable row level security;
alter table public.patient_note_versions enable row level security;
revoke all on public.patients, public.patient_assignments, public.patient_notes, public.patient_note_versions, public.patient_notes_current, public.patient_note_statistics from public, anon, authenticated;
grant all on public.patients, public.patient_assignments, public.patient_notes, public.patient_note_versions to service_role;
grant select on public.patient_notes_current, public.patient_note_statistics to service_role;

create function public.patient_actor_can_access(p_actor_user_id uuid, p_patient_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles role
    where role.user_id = p_actor_user_id and role.role = 'super_admin'
  ) or exists (
    select 1 from public.patient_assignments assignment
    where assignment.patient_id = p_patient_id
      and assignment.user_id = p_actor_user_id
      and assignment.ended_at is null
  );
$$;

create function public.create_patient_record(
  p_actor_user_id uuid,
  p_full_name text,
  p_email text,
  p_assignee_user_id uuid default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_assignee_user_id uuid := p_assignee_user_id;
  v_is_super_admin boolean;
begin
  select exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') into v_is_super_admin;
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role in ('super_admin', 'employee', 'practitioner')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) not between 2 and 120
    or (p_email is not null and (char_length(p_email) not between 3 and 254 or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then
    raise exception 'invalid_patient' using errcode = '22023';
  end if;
  if not v_is_super_admin then
    if v_assignee_user_id is not null and v_assignee_user_id <> p_actor_user_id then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    v_assignee_user_id := p_actor_user_id;
  elsif v_assignee_user_id is not null and not exists (
    select 1 from public.user_roles where user_id = v_assignee_user_id and role in ('super_admin', 'employee', 'practitioner')
  ) then
    raise exception 'invalid_assignee' using errcode = '22023';
  end if;

  insert into public.patients (full_name, email, created_by)
  values (regexp_replace(trim(p_full_name), '\s+', ' ', 'g'), nullif(lower(trim(coalesce(p_email, ''))), ''), p_actor_user_id)
  returning id into v_patient_id;
  if v_assignee_user_id is not null then
    insert into public.patient_assignments (patient_id, user_id, assigned_by)
    values (v_patient_id, v_assignee_user_id, p_actor_user_id);
  end if;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, 'patient.created', 'patient', v_patient_id::text, p_request_id, '/api/admin/clienten', jsonb_build_object('assigned', v_assignee_user_id is not null));
  return v_patient_id;
end;
$$;

create function public.create_patient_from_booking(p_actor_user_id uuid, p_booking_id uuid, p_request_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_patient_id uuid;
  v_customer_user_id uuid;
  v_assignee_user_id uuid;
  v_is_super_admin boolean;
  v_existing_patient_status text;
begin
  select exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') into v_is_super_admin;
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role in ('super_admin', 'employee', 'practitioner')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not v_is_super_admin and not exists (
    select 1 from public.practitioners practitioner
    where practitioner.user_id = p_actor_user_id and practitioner.id = (select practitioner_id from public.bookings where id = p_booking_id)
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_booking.status not in ('confirmed', 'completed', 'no_show') then
    raise exception 'booking_not_ready' using errcode = '22023';
  end if;
  if v_booking.patient_id is not null then
    if not public.patient_actor_can_access(p_actor_user_id, v_booking.patient_id) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
    values (p_actor_user_id, 'patient.booking_linked', 'patient', v_booking.patient_id::text, p_request_id, '/api/admin/clienten', jsonb_build_object('booking_id', p_booking_id));
    return v_booking.patient_id;
  end if;

  select practitioner.user_id into v_assignee_user_id
  from public.practitioners practitioner where practitioner.id = v_booking.practitioner_id;
  if v_assignee_user_id is null and exists (select 1 from public.user_roles where user_id = p_actor_user_id and role in ('employee', 'practitioner')) then
    v_assignee_user_id := p_actor_user_id;
  end if;

  if v_booking.customer_user_id is not null and exists (
    select 1 from public.user_roles where user_id = v_booking.customer_user_id and role = 'customer'
  ) and not exists (
    select 1 from public.user_roles where user_id = v_booking.customer_user_id and role in ('super_admin', 'support', 'employee', 'practitioner')
  ) then
    v_customer_user_id := v_booking.customer_user_id;
    select id, status into v_patient_id, v_existing_patient_status from public.patients where customer_user_id = v_customer_user_id for update;
  end if;

  if v_patient_id is null then
    insert into public.patients (full_name, email, customer_user_id, created_by)
    values (v_booking.client_name, lower(v_booking.client_email), v_customer_user_id, p_actor_user_id)
    on conflict (customer_user_id) where customer_user_id is not null do nothing
    returning id into v_patient_id;
    if v_patient_id is null and v_customer_user_id is not null then
      select id into v_patient_id from public.patients where customer_user_id = v_customer_user_id;
    end if;
  end if;

  if v_patient_id is null then raise exception 'patient_create_failed' using errcode = 'P0001'; end if;
  select status into v_existing_patient_status from public.patients where id = v_patient_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_existing_patient_status <> 'active' then raise exception 'patient_archived' using errcode = '22023'; end if;
  if v_assignee_user_id is not null and exists (
    select 1 from public.user_roles where user_id = v_assignee_user_id and role in ('super_admin', 'employee', 'practitioner')
  ) then
    insert into public.patient_assignments (patient_id, user_id, assigned_by)
    values (v_patient_id, v_assignee_user_id, p_actor_user_id)
    on conflict (patient_id, user_id) where ended_at is null do nothing;
  end if;
  update public.bookings set patient_id = v_patient_id where id = p_booking_id and patient_id is null;
  update public.patients set updated_at = now() where id = v_patient_id;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, 'patient.created_or_linked_from_booking', 'patient', v_patient_id::text, p_request_id, '/api/admin/clienten', jsonb_build_object('booking_id', p_booking_id));
  return v_patient_id;
end;
$$;

create function public.link_patient_booking(p_actor_user_id uuid, p_patient_id uuid, p_booking_id uuid, p_request_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_patient public.patients%rowtype;
  v_is_super_admin boolean;
begin
  select exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') into v_is_super_admin;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into v_patient from public.patients where id = p_patient_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.patient_actor_can_access(p_actor_user_id, p_patient_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_patient.status <> 'active' then raise exception 'patient_archived' using errcode = '22023'; end if;
  if not v_is_super_admin and not exists (
    select 1 from public.practitioners where id = v_booking.practitioner_id and user_id = p_actor_user_id
  ) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_booking.status not in ('confirmed', 'completed', 'no_show') then raise exception 'booking_not_ready' using errcode = '22023'; end if;
  if v_booking.patient_id is not null and v_booking.patient_id <> p_patient_id then raise exception 'booking_already_linked' using errcode = '23505'; end if;
  if v_booking.customer_user_id is not null then
    if not exists (
      select 1 from public.user_roles where user_id = v_booking.customer_user_id and role = 'customer'
    ) or exists (
      select 1 from public.user_roles where user_id = v_booking.customer_user_id
        and role in ('super_admin', 'support', 'employee', 'practitioner')
    ) then
      raise exception 'booking_patient_mismatch' using errcode = '22023';
    end if;
    if v_patient.customer_user_id is not null and v_patient.customer_user_id <> v_booking.customer_user_id then
      raise exception 'booking_patient_mismatch' using errcode = '22023';
    end if;
    if v_patient.customer_user_id is null then
      if v_patient.email is not null and lower(trim(v_booking.client_email)) <> v_patient.email then
        raise exception 'booking_patient_mismatch' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.patients where customer_user_id = v_booking.customer_user_id and id <> p_patient_id
      ) then
        raise exception 'patient_account_already_linked' using errcode = '23505';
      end if;
      begin
        update public.patients
        set customer_user_id = v_booking.customer_user_id,
            email = coalesce(email, lower(trim(v_booking.client_email)))
        where id = p_patient_id;
      exception when unique_violation then
        raise exception 'patient_account_already_linked' using errcode = '23505';
      end;
      v_patient.customer_user_id := v_booking.customer_user_id;
      v_patient.email := coalesce(v_patient.email, lower(trim(v_booking.client_email)));
    end if;
  else
    if v_patient.email is not null and lower(trim(v_booking.client_email)) <> v_patient.email then
      raise exception 'booking_patient_mismatch' using errcode = '22023';
    end if;
    if v_patient.email is null and regexp_replace(lower(trim(v_booking.client_name)), '[[:space:]]+', ' ', 'g')
      <> regexp_replace(lower(trim(v_patient.full_name)), '[[:space:]]+', ' ', 'g') then
      raise exception 'booking_patient_mismatch' using errcode = '22023';
    end if;
  end if;
  update public.bookings set patient_id = p_patient_id where id = p_booking_id;
  update public.patients set updated_at = now() where id = p_patient_id;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, 'patient.booking_linked', 'booking', p_booking_id::text, p_request_id, '/api/admin/clienten/' || p_patient_id::text || '/afspraken', jsonb_build_object('patient_id', p_patient_id, 'customer_account_linked', v_booking.customer_user_id is not null));
end;
$$;

create function public.create_patient_note(
  p_actor_user_id uuid,
  p_patient_id uuid,
  p_booking_id uuid,
  p_note_type text,
  p_occurred_at timestamptz,
  p_title text,
  p_body text,
  p_status text,
  p_corrects_note_id uuid default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_note_id uuid;
  v_patient_status text;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role in ('super_admin', 'employee', 'practitioner')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select status into v_patient_status from public.patients where id = p_patient_id for update;
  if v_patient_status is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.patient_actor_can_access(p_actor_user_id, p_patient_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v_patient_status <> 'active' then raise exception 'patient_archived' using errcode = '22023'; end if;
  if p_note_type not in ('intake', 'session', 'follow_up', 'other', 'correction')
    or p_status not in ('draft', 'final')
    or char_length(trim(coalesce(p_title, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_body, ''))) not between 1 and 20000
    or p_occurred_at is null then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  if p_booking_id is not null and not exists (
    select 1 from public.bookings where id = p_booking_id and patient_id = p_patient_id
  ) then raise exception 'booking_not_linked' using errcode = '22023'; end if;
  if (p_note_type = 'correction' and p_corrects_note_id is null) or (p_corrects_note_id is not null and (
    p_note_type <> 'correction' or not exists (
      select 1 from public.patient_notes where id = p_corrects_note_id and patient_id = p_patient_id and status = 'final'
    )
  )) then raise exception 'invalid_correction' using errcode = '22023'; end if;

  insert into public.patient_notes (patient_id, booking_id, note_type, occurred_at, status, created_by, finalized_at, finalized_by, corrects_note_id)
  values (p_patient_id, p_booking_id, p_note_type, p_occurred_at, p_status, p_actor_user_id,
    case when p_status = 'final' then now() else null end,
    case when p_status = 'final' then p_actor_user_id else null end,
    p_corrects_note_id)
  returning id into v_note_id;
  insert into public.patient_note_versions (note_id, version_number, title, body, created_by)
  values (v_note_id, 1, trim(p_title), trim(p_body), p_actor_user_id);
  update public.patients set updated_at = now() where id = p_patient_id;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, 'patient.note_created', 'patient_note', v_note_id::text, p_request_id,
    '/api/admin/clienten/' || p_patient_id::text || '/notities', jsonb_build_object('patient_id', p_patient_id, 'status', p_status, 'version', 1));
  return v_note_id;
end;
$$;

create function public.append_patient_note_version(
  p_actor_user_id uuid,
  p_note_id uuid,
  p_expected_version integer,
  p_title text,
  p_body text,
  p_finalize boolean,
  p_request_id uuid default null
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_note public.patient_notes%rowtype;
  v_is_super_admin boolean;
  v_next_version integer;
  v_patient_status text;
begin
  select exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') into v_is_super_admin;
  select * into v_note from public.patient_notes where id = p_note_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select status into v_patient_status from public.patients where id = v_note.patient_id for update;
  if v_patient_status is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.patient_actor_can_access(p_actor_user_id, v_note.patient_id)
    or not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role in ('super_admin', 'employee', 'practitioner')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_note.status <> 'draft' or (not v_is_super_admin and coalesce(v_note.created_by <> p_actor_user_id, true)) then
    raise exception 'note_locked' using errcode = '22023';
  end if;
  if v_patient_status <> 'active' then raise exception 'patient_archived' using errcode = '22023'; end if;
  if v_note.current_version <> p_expected_version then raise exception 'version_conflict' using errcode = '40001'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_body, ''))) not between 1 and 20000 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  v_next_version := v_note.current_version + 1;
  insert into public.patient_note_versions (note_id, version_number, title, body, created_by)
  values (p_note_id, v_next_version, trim(p_title), trim(p_body), p_actor_user_id);
  update public.patient_notes
  set current_version = v_next_version,
      status = case when p_finalize then 'final' else status end,
      finalized_at = case when p_finalize then now() else null end,
      finalized_by = case when p_finalize then p_actor_user_id else null end
  where id = p_note_id;
  update public.patients set updated_at = now() where id = v_note.patient_id;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, case when p_finalize then 'patient.note_finalized' else 'patient.note_draft_saved' end,
    'patient_note', p_note_id::text, p_request_id, '/api/admin/notities/' || p_note_id::text,
    jsonb_build_object('patient_id', v_note.patient_id, 'status', case when p_finalize then 'final' else 'draft' end, 'version', v_next_version));
  return v_next_version;
end;
$$;

create function public.change_patient_assignment(
  p_actor_user_id uuid,
  p_patient_id uuid,
  p_assignee_user_id uuid,
  p_assign boolean,
  p_request_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient_status text;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select status into v_patient_status from public.patients where id = p_patient_id for update;
  if v_patient_status is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_assign then
    if v_patient_status <> 'active' then raise exception 'patient_archived' using errcode = '22023'; end if;
    if not exists (select 1 from public.user_roles where user_id = p_assignee_user_id and role in ('super_admin', 'employee', 'practitioner')) then
      raise exception 'invalid_assignee' using errcode = '22023';
    end if;
    insert into public.patient_assignments (patient_id, user_id, assigned_by)
    values (p_patient_id, p_assignee_user_id, p_actor_user_id)
    on conflict (patient_id, user_id) where ended_at is null do nothing;
  else
    update public.patient_assignments
    set ended_at = now(), ended_by = p_actor_user_id
    where patient_id = p_patient_id and user_id = p_assignee_user_id and ended_at is null;
  end if;
  update public.patients set updated_at = now() where id = p_patient_id;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, case when p_assign then 'patient.assigned' else 'patient.assignment_ended' end,
    'patient', p_patient_id::text, p_request_id, '/api/admin/clienten/' || p_patient_id::text || '/toewijzingen',
    jsonb_build_object('assignee_user_id', p_assignee_user_id));
end;
$$;

create function public.archive_patient_record(p_actor_user_id uuid, p_patient_id uuid, p_archive boolean, p_request_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.patients set status = case when p_archive then 'archived' else 'active' end,
    archived_at = case when p_archive then now() else null end
  where id = p_patient_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, case when p_archive then 'patient.archived' else 'patient.restored' end,
    'patient', p_patient_id::text, p_request_id, '/api/admin/clienten/' || p_patient_id::text || '/archiveren', jsonb_build_object('status', case when p_archive then 'archived' else 'active' end));
end;
$$;

revoke all on function public.patient_actor_can_access(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_patient_record(uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_patient_from_booking(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.link_patient_booking(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_patient_note(uuid, uuid, uuid, text, timestamptz, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.append_patient_note_version(uuid, uuid, integer, text, text, boolean, uuid) from public, anon, authenticated;
revoke all on function public.change_patient_assignment(uuid, uuid, uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function public.archive_patient_record(uuid, uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.patient_actor_can_access(uuid, uuid) to service_role;
grant execute on function public.create_patient_record(uuid, text, text, uuid, uuid) to service_role;
grant execute on function public.create_patient_from_booking(uuid, uuid, uuid) to service_role;
grant execute on function public.link_patient_booking(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.create_patient_note(uuid, uuid, uuid, text, timestamptz, text, text, text, uuid, uuid) to service_role;
grant execute on function public.append_patient_note_version(uuid, uuid, integer, text, text, boolean, uuid) to service_role;
grant execute on function public.change_patient_assignment(uuid, uuid, uuid, boolean, uuid) to service_role;
grant execute on function public.archive_patient_record(uuid, uuid, boolean, uuid) to service_role;

-- Existing guest bookings are intentionally not merged by name or email. A staff
-- member explicitly creates or links a patient record from a confirmed booking.
