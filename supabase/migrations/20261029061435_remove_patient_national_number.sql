-- Stop collecting national identifiers. Keep only an empty compatibility column
-- while older frontend deployments can still explicitly select this column.
-- Old form submissions are ignored by save_patient_details; direct writes are
-- rejected by the database constraint. No national identifier can be stored.
update public.patients set national_number = '' where national_number <> '';
alter table public.patients add constraint patients_no_national_number
 check (national_number = '');
comment on column public.patients.national_number is
 'Empty compatibility field only. Collection and storage of national identifiers are prohibited.';

create or replace function public.save_patient_details(p_actor uuid,p_patient uuid,p_details jsonb,p_expected timestamptz default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_patient public.patients%rowtype; v_customer boolean;
begin
 select * into v_patient from public.patients where id=p_patient for update;
 if not found or v_patient.status<>'active' then raise exception 'patient_unavailable' using errcode='22023'; end if;
 v_customer := p_actor=v_patient.customer_user_id and exists(select 1 from public.user_roles where user_id=p_actor and role='customer');
 if not v_customer and not public.patient_actor_can_access(p_actor,p_patient) then raise exception 'not_allowed' using errcode='42501'; end if;
 if p_expected is not null and v_patient.updated_at<>p_expected then raise exception 'version_conflict' using errcode='40001'; end if;
 if char_length(trim(coalesce(p_details->>'first_name','')))<1 or char_length(trim(coalesce(p_details->>'last_name','')))<1
 or nullif(p_details->>'birth_date','')::date>timezone('Europe/Brussels',now())::date then raise exception 'invalid_patient' using errcode='22023'; end if;
 update public.patients set
 first_name=trim(p_details->>'first_name'),last_name=trim(p_details->>'last_name'),
 full_name=trim(p_details->>'first_name')||' '||trim(p_details->>'last_name'),
 birth_date=nullif(p_details->>'birth_date','')::date,gender=coalesce(p_details->>'gender',''),salutation=coalesce(p_details->>'salutation',''),
 intake_date=case when v_customer then intake_date else nullif(p_details->>'intake_date','')::date end,
 street=coalesce(p_details->>'street',''),house_number=coalesce(p_details->>'house_number',''),address_box=coalesce(p_details->>'address_box',''),
 postal_code=coalesce(p_details->>'postal_code',''),city=coalesce(p_details->>'city',''),country=coalesce(nullif(p_details->>'country',''),'BE'),
 mobile=coalesce(p_details->>'mobile',''),
 registration_reason=case when v_customer and registration_reason<>'' then registration_reason else coalesce(p_details->>'registration_reason','') end,
 referrer=case when v_customer and referrer<>'' then referrer else coalesce(p_details->>'referrer','') end,
 email=case when v_customer then email else nullif(lower(trim(p_details->>'email')),'') end
 where id=p_patient;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id) values(p_actor,'patient.details_updated','patient',p_patient::text);
end; $$;
revoke all on function public.save_patient_details(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.save_patient_details(uuid,uuid,jsonb,timestamptz) to service_role;
