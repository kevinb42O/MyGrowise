-- An account becomes a care dossier only after a superadmin explicitly links it.
-- Keep account selection on the trusted server; patients and notes remain private.
create view public.patient_customer_candidates as
select profile.id, profile.full_name, auth_user.email, profile.created_at
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where exists (
  select 1 from public.user_roles as role
  where role.user_id = profile.id and role.role = 'customer'
)
and not exists (
  select 1 from public.user_roles as role
  where role.user_id = profile.id
    and role.role in ('super_admin', 'support', 'employee', 'practitioner', 'admin', 'content_editor', 'clinical_reviewer', 'analyst')
)
and not exists (
  select 1 from public.patients as patient
  where patient.customer_user_id = profile.id
);

revoke all on public.patient_customer_candidates from public, anon, authenticated;
grant select on public.patient_customer_candidates to service_role;

create function public.create_patient_from_customer(
  p_actor_user_id uuid,
  p_customer_user_id uuid,
  p_assignee_user_id uuid default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_customer record;
  v_patient_id uuid;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_assignee_user_id is not null and not exists (
    select 1 from public.user_roles where user_id = p_assignee_user_id and role in ('super_admin', 'employee', 'practitioner')
  ) then
    raise exception 'invalid_assignee' using errcode = '22023';
  end if;

  select id into v_patient_id from public.patients where customer_user_id = p_customer_user_id;
  if v_patient_id is not null then return v_patient_id; end if;
  select * into v_customer from public.patient_customer_candidates where id = p_customer_user_id;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  if char_length(trim(coalesce(v_customer.full_name, ''))) not between 2 and 120 then
    raise exception 'invalid_patient' using errcode = '22023';
  end if;
  if v_customer.email is not null and exists (
    select 1 from public.patients
    where customer_user_id is null and lower(email) = lower(v_customer.email)
  ) then
    raise exception 'potential_patient_match' using errcode = '23505';
  end if;

  insert into public.patients (full_name, email, customer_user_id, created_by)
  values (trim(v_customer.full_name), lower(v_customer.email), p_customer_user_id, p_actor_user_id)
  on conflict (customer_user_id) where customer_user_id is not null do nothing
  returning id into v_patient_id;
  if v_patient_id is null then
    select id into v_patient_id from public.patients where customer_user_id = p_customer_user_id;
  end if;
  if v_patient_id is null then raise exception 'patient_create_failed' using errcode = 'P0001'; end if;

  if p_assignee_user_id is not null then
    insert into public.patient_assignments (patient_id, user_id, assigned_by)
    values (v_patient_id, p_assignee_user_id, p_actor_user_id)
    on conflict (patient_id, user_id) where ended_at is null do nothing;
  end if;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, 'patient.created_from_customer', 'patient', v_patient_id::text, p_request_id,
    '/api/admin/clienten', jsonb_build_object('customer_account_linked', true));
  return v_patient_id;
end;
$$;

create function public.link_patient_customer_account(
  p_actor_user_id uuid,
  p_patient_id uuid,
  p_customer_user_id uuid,
  p_request_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient public.patients%rowtype;
  v_customer record;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role = 'super_admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_patient from public.patients where id = p_patient_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_patient.status <> 'active' then raise exception 'patient_archived' using errcode = '22023'; end if;
  if v_patient.customer_user_id is not null then raise exception 'patient_account_already_linked' using errcode = '23505'; end if;
  select * into v_customer from public.patient_customer_candidates where id = p_customer_user_id;
  if not found then raise exception 'customer_not_found' using errcode = 'P0002'; end if;
  if v_patient.email is null or v_customer.email is null or lower(trim(v_patient.email)) <> lower(trim(v_customer.email)) then
    raise exception 'patient_account_mismatch' using errcode = '23514';
  end if;

  update public.patients set customer_user_id = p_customer_user_id where id = p_patient_id;
  update public.bookings set patient_id = p_patient_id
  where customer_user_id = p_customer_user_id and patient_id is null;
  insert into public.patient_assignments (patient_id, user_id, assigned_by)
  select distinct p_patient_id, practitioner.user_id, p_actor_user_id
  from public.bookings as booking
  join public.practitioners as practitioner on practitioner.id = booking.practitioner_id
  where booking.patient_id = p_patient_id and practitioner.user_id is not null
    and booking.status in ('confirmed', 'completed', 'no_show')
  on conflict (patient_id, user_id) where ended_at is null do nothing;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, request_id, request_path, metadata)
  values (p_actor_user_id, 'patient.customer_account_linked', 'patient', p_patient_id::text, p_request_id,
    '/api/admin/clienten/' || p_patient_id::text || '/account', jsonb_build_object('customer_account_linked', true));
end;
$$;

revoke all on function public.create_patient_from_customer(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_patient_from_customer(uuid, uuid, uuid, uuid) to service_role;
revoke all on function public.link_patient_customer_account(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_patient_customer_account(uuid, uuid, uuid, uuid) to service_role;
