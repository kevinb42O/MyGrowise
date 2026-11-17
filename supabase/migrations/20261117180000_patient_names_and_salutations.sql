-- Additive rollout: apply before the application. Existing RPCs remain compatible.
alter table public.patients drop constraint patients_extended_fields;
alter table public.patients add constraint patients_extended_fields check (
 char_length(first_name)<=60 and char_length(last_name)<=60 and char_length(street)<=150
 and char_length(house_number)<=20 and char_length(address_box)<=20 and char_length(postal_code)<=20
 and char_length(city)<=100 and country ~ '^[A-Z]{2}$' and char_length(mobile)<=35
 and national_number=''
 and gender in ('','female','male','other','unspecified')
 and salutation in ('','mevrouw','meneer','heer','heer_mevrouw','guardians','couple')
 and char_length(registration_reason)<=3000 and char_length(referrer)<=300
);

-- Reuse all existing authorization, assignment and audit logic in the same transaction.
create function public.create_patient_with_names(p_actor_user_id uuid,p_first_name text,p_last_name text,p_email text,
 p_assignee_user_id uuid default null,p_request_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare patient uuid;
begin
 p_first_name:=trim(p_first_name); p_last_name:=trim(p_last_name);
 if coalesce(char_length(p_first_name),0) not between 1 and 60 or coalesce(char_length(p_last_name),0) not between 1 and 60
 or char_length(p_first_name||' '||p_last_name)>120 then raise exception 'invalid_patient' using errcode='22023'; end if;
 patient:=public.create_patient_record(p_actor_user_id,p_first_name||' '||p_last_name,p_email,p_assignee_user_id,p_request_id);
 update public.patients set first_name=p_first_name,last_name=p_last_name,full_name=p_first_name||' '||p_last_name where id=patient;
 return patient;
end; $$;

create function public.book_new_patient_with_names(p_actor uuid,p_key uuid,p_first_name text,p_last_name text,p_email text,
 p_offer uuid,p_starts timestamptz,p_birth_date date,p_request uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare booking uuid; patient uuid; names jsonb; previous jsonb;
begin
 p_first_name:=trim(p_first_name); p_last_name:=trim(p_last_name);
 if coalesce(char_length(p_first_name),0) not between 1 and 60 or coalesce(char_length(p_last_name),0) not between 1 and 60
 or char_length(p_first_name||' '||p_last_name)>120 then raise exception 'invalid_patient' using errcode='22023'; end if;
 -- The key protects the split as well as the combined name. Retrying must not undo later edits.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_key::text,4));
 select input into previous from public.staff_booking_submissions where actor_id=p_actor and submission_key=p_key;
 names:=jsonb_build_object('firstName',p_first_name,'lastName',p_last_name);
 if previous is not null and previous->'names' is distinct from names then raise exception 'idempotency_conflict' using errcode='23505'; end if;
 -- The existing function compares its original input object exactly.
 if previous is not null then
   update public.staff_booking_submissions set input=input-'names' where actor_id=p_actor and submission_key=p_key;
 end if;
 booking:=public.book_new_patient(p_actor,p_key,p_first_name||' '||p_last_name,p_email,p_offer,p_starts,p_birth_date,p_request);
 if previous is null then
   select patient_id into patient from public.bookings where id=booking;
   update public.patients set first_name=p_first_name,last_name=p_last_name,full_name=p_first_name||' '||p_last_name where id=patient;
 end if;
 update public.staff_booking_submissions set input=input||jsonb_build_object('names',names) where actor_id=p_actor and submission_key=p_key;
 return booking;
end; $$;

-- Only explicitly linked account identity AND an exact full-name match may supply parts.
-- commerce_buyers.first_name alone can contain a legacy full name: require both parts.
-- Neither email nor name alone links accounts. Never rewrite full_name or booking snapshots.
create function public.fill_linked_patient_names() returns trigger
language plpgsql security invoker set search_path='' as $$
declare source record;
begin
 if new.customer_user_id is null or (new.first_name<>'' and new.last_name<>'') then return new; end if;
 select first_name,last_name into source from public.commerce_buyers
 where customer_user_id=new.customer_user_id and trim(first_name)<>'' and trim(last_name)<>''
 and first_name||' '||last_name=new.full_name
 and (new.first_name='' or new.first_name=first_name) and (new.last_name='' or new.last_name=last_name);
 if found then
   if new.first_name='' then new.first_name:=source.first_name; end if;
   if new.last_name='' then new.last_name:=source.last_name; end if;
 end if;
 return new;
end; $$;
create trigger patients_fill_linked_names before insert or update of customer_user_id on public.patients
for each row execute function public.fill_linked_patient_names();

-- Repeatable conservative repair; returns aggregate counts without personal data.
create function public.repair_missing_patient_names() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare repaired integer; unresolved integer;
begin
 update public.patients p set first_name=case when p.first_name='' then b.first_name else p.first_name end,
 last_name=case when p.last_name='' then b.last_name else p.last_name end
 from public.commerce_buyers b
 where p.customer_user_id=b.customer_user_id and (p.first_name='' or p.last_name='')
 and trim(b.first_name)<>'' and trim(b.last_name)<>'' and b.first_name||' '||b.last_name=p.full_name
 and (p.first_name='' or p.first_name=b.first_name) and (p.last_name='' or p.last_name=b.last_name);
 get diagnostics repaired=row_count;
 select count(*) into unresolved from public.patients where first_name='' or last_name='';
 return jsonb_build_object('repaired',repaired,'requires_manual_review',unresolved);
end; $$;
select public.repair_missing_patient_names();

revoke all on function public.create_patient_with_names(uuid,text,text,text,uuid,uuid),
 public.book_new_patient_with_names(uuid,uuid,text,text,text,uuid,timestamptz,date,uuid),
 public.fill_linked_patient_names(),public.repair_missing_patient_names() from public,anon,authenticated;
grant execute on function public.create_patient_with_names(uuid,text,text,text,uuid,uuid),
 public.book_new_patient_with_names(uuid,uuid,text,text,text,uuid,timestamptz,date,uuid),
 public.fill_linked_patient_names(),public.repair_missing_patient_names() to service_role;
