-- Store formatting in the same immutable snapshot as its searchable plain text.
-- Existing rows and positional calls remain valid; optional formatting defaults to NULL.
begin;
alter table public.patient_note_versions add column body_document jsonb;
alter table public.patient_note_versions add constraint patient_note_versions_document_shape check (
  body_document is null or coalesce(jsonb_typeof(body_document) = 'object'
    and body_document ->> 'type' = 'doc'
    and jsonb_typeof(body_document -> 'content') = 'array'
    and octet_length(body_document::text) <= 250000, false)
);
create or replace view public.patient_notes_current as
select note.id, note.patient_id, note.booking_id, note.note_type, note.occurred_at,
  note.status, note.current_version, note.created_by, note.created_at, note.updated_at,
  note.finalized_at, note.finalized_by, note.corrects_note_id,
  version.title, version.body, version.created_at as version_created_at, version.body_document
from public.patient_notes as note
join public.patient_note_versions as version
  on version.note_id = note.id and version.version_number = note.current_version;

drop function public.create_patient_note(uuid,uuid,uuid,text,timestamptz,text,text,text,uuid,uuid);
drop function public.append_patient_note_version(uuid,uuid,integer,text,text,boolean,uuid);

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
  p_request_id uuid default null,
  p_body_document jsonb default null
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
  insert into public.patient_note_versions (note_id, version_number, title, body, created_by, body_document)
  values (v_note_id, 1, trim(p_title), trim(p_body), p_actor_user_id, p_body_document);
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
  p_request_id uuid default null,
  p_body_document jsonb default null
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
  insert into public.patient_note_versions (note_id, version_number, title, body, created_by, body_document)
  values (p_note_id, v_next_version, trim(p_title), trim(p_body), p_actor_user_id, p_body_document);
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

revoke all on function public.create_patient_note(uuid,uuid,uuid,text,timestamptz,text,text,text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.append_patient_note_version(uuid,uuid,integer,text,text,boolean,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_patient_note(uuid,uuid,uuid,text,timestamptz,text,text,text,uuid,uuid,jsonb) to service_role;
grant execute on function public.append_patient_note_version(uuid,uuid,integer,text,text,boolean,uuid,jsonb) to service_role;
commit;
