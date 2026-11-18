-- Create identity, assignment and full details in one transaction. A validation
-- failure in save_patient_details also rolls back the new record and audit rows.
create function public.create_patient_with_details(
 p_actor_user_id uuid, p_details jsonb,
 p_assignee_user_id uuid default null, p_request_id uuid default null
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare patient uuid;
begin
 patient:=public.create_patient_with_names(p_actor_user_id,p_details->>'first_name',p_details->>'last_name',
  nullif(lower(trim(p_details->>'email')),''),p_assignee_user_id,p_request_id);
 perform public.save_patient_details(p_actor_user_id,patient,p_details);
 return patient;
end; $$;

revoke all on function public.create_patient_with_details(uuid,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_patient_with_details(uuid,jsonb,uuid,uuid) to service_role;
