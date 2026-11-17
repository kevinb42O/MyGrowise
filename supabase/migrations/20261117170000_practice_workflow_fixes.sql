-- Existing explicit patient/account identities also own earlier staff bookings.
create function public.sync_patient_booking_account() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.customer_user_id is null then return new; end if;
 if exists(select 1 from public.bookings where patient_id=new.id and customer_user_id is not null and customer_user_id<>new.customer_user_id) then
   raise exception 'booking_patient_mismatch' using errcode='23514';
 end if;
 update public.bookings set customer_user_id=new.customer_user_id where patient_id=new.id and customer_user_id is null;
 return new;
end; $$;
create trigger patients_sync_booking_account after update of customer_user_id on public.patients
for each row when (new.customer_user_id is distinct from old.customer_user_id) execute function public.sync_patient_booking_account();
with repaired as (update public.bookings b set customer_user_id=p.customer_user_id from public.patients p
where b.patient_id=p.id and b.customer_user_id is null and p.customer_user_id is not null
and not exists(select 1 from public.bookings conflicting where conflicting.patient_id=p.id and conflicting.customer_user_id is not null and conflicting.customer_user_id<>p.customer_user_id)
returning b.id)
insert into public.security_audit_log(action,object_type,object_id,metadata)
select 'booking.account_link_repaired','booking',id::text,jsonb_build_object('source','existing_patient_identity') from repaired;

alter table public.bookings
 add column cancellation_category text not null default 'unknown' check(cancellation_category in ('unknown','timely','late')),
 add column no_show_billing text not null default 'unreviewed' check(no_show_billing in ('unreviewed','invoiced','not_invoiced'));

-- Customer-visible status is separate from the private administrative decision.
create or replace function public.record_booking_status_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   insert into public.booking_status_events(booking_id,from_status,to_status,actor_user_id,occurred_at,request_id,customer_visible)
   values(new.id,null,new.status,new.customer_user_id,new.created_at,nullif(current_setting('app.booking_request_id',true),'')::uuid,true);
 elsif new.status is distinct from old.status then
   insert into public.booking_status_events(booking_id,from_status,to_status,actor_user_id,request_id,customer_visible)
   values(new.id,old.status,new.status,nullif(current_setting('app.booking_actor_user_id',true),'')::uuid,
     nullif(current_setting('app.booking_request_id',true),'')::uuid,coalesce(current_setting('app.booking_internal',true),'')<>'true' and new.status<>'no_show');
 end if;
 return new;
end; $$;

create function public.register_booking_outcome(p_actor uuid,p_booking uuid,p_revision timestamptz,p_status public.booking_status,
 p_category text default 'unknown',p_billing text default 'unreviewed',p_request uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype; owner uuid;
begin
 select practitioner_id into owner from public.bookings where id=p_booking;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select * into b from public.bookings where id=p_booking for update;
 if not (public.is_practice_manager(p_actor) or exists(select 1 from public.practitioners p join public.user_roles r on r.user_id=p.user_id and r.role='practitioner' where p.id=owner and p.user_id=p_actor)) then
   raise exception 'not_allowed' using errcode='42501';
 end if;
 if p_revision is null or b.updated_at is distinct from p_revision then raise exception 'agenda_changed' using errcode='40001'; end if;
 if p_status not in ('cancelled','no_show') or b.status not in ('confirmed','completed','cancelled','no_show')
 or p_category is null or p_category not in ('unknown','timely','late') or p_billing is null or p_billing not in ('unreviewed','invoiced','not_invoiced')
 or (p_status='no_show' and b.starts_at>now()) then raise exception 'invalid_input' using errcode='22023'; end if;
 perform set_config('app.booking_internal','true',true);
 perform set_config('app.booking_actor_user_id',p_actor::text,true);
 perform set_config('app.booking_request_id',coalesce(p_request::text,''),true);
 update public.bookings set status=p_status,cancellation_category=case when p_status='cancelled' then p_category else 'unknown' end,
   no_show_billing=case when p_status='no_show' then p_billing else 'unreviewed' end where id=p_booking;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,request_id,request_path,before_snapshot,after_snapshot)
 values(p_actor,'booking.outcome_registered','booking',p_booking::text,p_request,'/afspraken',
   jsonb_build_object('status',b.status,'cancellation_category',b.cancellation_category,'no_show_billing',b.no_show_billing),
   jsonb_build_object('status',p_status,'cancellation_category',case when p_status='cancelled' then p_category else 'unknown' end,'no_show_billing',case when p_status='no_show' then p_billing else 'unreviewed' end));
 perform set_config('app.booking_internal','false',true);
end; $$;

-- Guard all status entry points, including older booking-list forms.
create function public.guard_booking_outcome_time() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status is distinct from old.status and ((new.status='no_show' and new.starts_at>now()) or (new.status='completed' and new.ends_at>now())) then
   raise exception 'invalid_transition' using errcode='22023';
 end if;
 return new;
end; $$;
create trigger bookings_outcome_time before update of status on public.bookings for each row execute function public.guard_booking_outcome_time();

alter table public.booking_mail_jobs drop constraint booking_mail_jobs_kind_check;
alter table public.booking_mail_jobs add constraint booking_mail_jobs_kind_check check(kind in ('confirmation','rescheduled','cancelled','reminder'));
alter table public.booking_mail_jobs add column scheduled_for timestamptz not null default now();

create function public.schedule_booking_reminder(p_booking uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype; due timestamptz;
begin
 select * into b from public.bookings where id=p_booking;
 if not found or b.status<>'confirmed' then return; end if;
 due:=b.starts_at-interval '72 hours';
 -- Never catch up missed reminders or duplicate a just-created confirmation.
 if due<=now() then return; end if;
 perform public.enqueue_booking_mail(b.id,'reminder','reminder:'||b.id::text||':'||extract(epoch from b.starts_at)::text);
 update public.booking_mail_jobs set scheduled_for=due,next_attempt_at=due,attempts=0,lease_token=null,lease_until=null,last_error=null,
   status=case when coalesce((select booking_reminder_enabled from public.user_preferences where user_id=b.customer_user_id),true) then 'pending' else 'suppressed' end
 where event_key='reminder:'||b.id::text||':'||extract(epoch from b.starts_at)::text and status in ('pending','superseded','suppressed');
end; $$;

create or replace function public.booking_mail_and_intake_event() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
   if new.status='confirmed' then
     perform public.enqueue_booking_mail(new.id,'confirmation','confirmed:'||new.id::text);
     perform public.schedule_booking_reminder(new.id);
   end if;
 else
   if new.status='confirmed' and old.status='pending' then
     perform public.enqueue_booking_mail(new.id,'confirmation','confirmed:'||new.id::text);
     perform public.schedule_booking_reminder(new.id);
   elsif new.status='cancelled' and old.status is distinct from new.status and coalesce(current_setting('app.booking_internal',true),'')<>'true' then
     perform public.enqueue_booking_mail(new.id,'cancelled','cancelled:'||new.id::text);
   elsif new.status='confirmed' and new.starts_at is distinct from old.starts_at then
     perform public.enqueue_booking_mail(new.id,'rescheduled','rescheduled:'||new.id::text||':'||gen_random_uuid()::text);
     perform public.schedule_booking_reminder(new.id);
   end if;
   if new.status='completed' and new.session_kind='intake' then
     update public.patients set intake_date=(new.starts_at at time zone 'Europe/Brussels')::date
     where id=new.patient_id and (intake_date is null or intake_date>(new.starts_at at time zone 'Europe/Brussels')::date);
   end if;
 end if;
 return new;
end; $$;

create or replace function public.booking_mail_is_current(p_job uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select case
   when j.kind='cancelled' then b.status='cancelled'
   when j.kind='reminder' then b.status='confirmed' and b.starts_at>now()
     and (j.payload->>'startsAt')::timestamptz=b.starts_at
     and now() between j.scheduled_for and j.scheduled_for+interval '15 minutes'
     and coalesce(pref.booking_reminder_enabled,true)
   else b.status='confirmed' and b.ends_at>now()
     and (j.payload->>'startsAt')::timestamptz=b.starts_at and (j.payload->>'endsAt')::timestamptz=b.ends_at
   end from public.booking_mail_jobs j join public.bookings b on b.id=j.booking_id
   left join public.user_preferences pref on pref.user_id=b.customer_user_id
   where j.id=p_job and j.status not in ('suppressed','superseded')),false);
$$;

create or replace function public.supersede_booking_mail() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 update public.booking_mail_jobs j set status='superseded',lease_token=null,lease_until=null
 where j.booking_id=new.id and j.status in ('pending','failed')
 and (new.starts_at is distinct from old.starts_at or new.status<>'confirmed');
 return new;
end; $$;
drop trigger bookings_00_supersede_mail on public.bookings;
create trigger bookings_00_supersede_mail before update of status,starts_at on public.bookings for each row
when (new.status is distinct from old.status or new.starts_at is distinct from old.starts_at) execute function public.supersede_booking_mail();

-- Reminder preference is distinct from transactional booking-email preference.
create or replace function public.enqueue_booking_mail(p_booking uuid,p_kind text,p_key text) returns void
language sql security invoker set search_path='' as $$
 insert into public.booking_mail_jobs(booking_id,event_key,kind,recipient,status,payload)
 select b.id,p_key,p_kind,b.client_email,case when case when p_kind='reminder' then coalesce(pref.booking_reminder_enabled,true) else coalesce(pref.booking_email_enabled,true) end then 'pending' else 'suppressed' end,
 jsonb_build_object('name',b.client_name,'salutation',coalesce(patient.salutation,''),'appointment',b.appointment_name,'practitioner',p.name,
   'startsAt',b.starts_at,'endsAt',b.ends_at,'channel',b.channel,'location',b.location,'instructions',b.instructions)
 from public.bookings b join public.practitioners p on p.id=b.practitioner_id
 left join public.patients patient on patient.id=b.patient_id left join public.user_preferences pref on pref.user_id=b.customer_user_id
 where b.id=p_booking on conflict(event_key) do nothing;
$$;

-- One-time, future deadlines only; no backdated reminder deliveries.
select public.schedule_booking_reminder(id) from public.bookings where status='confirmed' and starts_at>now()+interval '72 hours';

-- Idempotent, atomic minimal-client creation plus booking. Rollback on conflicts.
create table public.staff_booking_submissions (
 actor_id uuid not null references public.profiles(id), submission_key uuid not null,
 booking_id uuid not null references public.bookings(id), input jsonb not null, primary key(actor_id,submission_key)
);
alter table public.staff_booking_submissions enable row level security;
revoke all on public.staff_booking_submissions from public,anon,authenticated;
grant all on public.staff_booking_submissions to service_role;

create function public.book_new_patient(p_actor uuid,p_key uuid,p_name text,p_email text,p_offer uuid,p_starts timestamptz,p_birth_date date,p_request uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare patient uuid; booking uuid; existing record; input jsonb; assignee uuid;
begin
 if p_key is null or p_birth_date is null or p_birth_date>(now() at time zone 'Europe/Brussels')::date or p_birth_date<date '1900-01-01' then raise exception 'invalid_input' using errcode='22023'; end if;
 p_name:=regexp_replace(trim(p_name),'\s+',' ','g'); p_email:=lower(trim(p_email));
 input:=jsonb_build_object('name',p_name,'email',p_email,'offer',p_offer,'starts',p_starts,'birthDate',p_birth_date);
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_key::text,4));
 select * into existing from public.staff_booking_submissions where actor_id=p_actor and submission_key=p_key;
 if found then
   if existing.input<>input then raise exception 'idempotency_conflict' using errcode='23505'; end if;
   return existing.booking_id;
 end if;
 if not exists(select 1 from public.user_roles where user_id=p_actor and role in ('super_admin','employee','practitioner')) then raise exception 'not_allowed' using errcode='42501'; end if;
 -- Serialize duplicate checks across simultaneous new-client forms.
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_email,''),5));
 if p_email is null or p_email='' then raise exception 'invalid_input' using errcode='22023'; end if;
 if exists(select 1 from public.patients where lower(email)=p_email or lower(full_name)=lower(p_name)) then raise exception 'potential_patient_match' using errcode='22023'; end if;
 select p.user_id into assignee from public.practitioner_appointment_types o join public.practitioners p on p.id=o.practitioner_id where o.id=p_offer;
 patient:=public.create_patient_record(p_actor,p_name,p_email,case when exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then assignee else p_actor end,p_request);
 update public.patients set birth_date=p_birth_date where id=patient;
 booking:=public.create_typed_staff_booking(p_actor,patient,p_offer,p_starts,p_request);
 insert into public.staff_booking_submissions values(p_actor,p_key,booking,input);
 return booking;
end; $$;

-- Recent visits store IDs only and are re-authorized when read.
create table public.patient_recent_visits (
 user_id uuid not null references public.profiles(id) on delete cascade,
 patient_id uuid not null references public.patients(id) on delete cascade,
 visited_at timestamptz not null default now(), primary key(user_id,patient_id)
);
alter table public.patient_recent_visits enable row level security;
revoke all on public.patient_recent_visits from public,anon,authenticated;
grant all on public.patient_recent_visits to service_role;
create function public.record_patient_visit(p_actor uuid,p_patient uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.patient_actor_can_access(p_actor,p_patient) then raise exception 'not_allowed' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,6));
 insert into public.patient_recent_visits values(p_actor,p_patient,clock_timestamp()) on conflict(user_id,patient_id) do update set visited_at=excluded.visited_at;
 delete from public.patient_recent_visits where user_id=p_actor and patient_id not in
   (select patient_id from public.patient_recent_visits where user_id=p_actor order by visited_at desc,patient_id limit 5);
end; $$;

create function public.patient_search_text(p_text text) returns text language sql immutable set search_path='' as $$
 select translate(lower(coalesce(p_text,'')),'áàäâãåéèëêíìïîóòöôõúùüûçñ','aaaaaaeeeeiiiiooooouuuucn');
$$;
create function public.search_patient_choices(p_actor uuid,p_search text,p_recent boolean default false)
returns table(id uuid,name text,email text,status text) language sql stable security invoker set search_path='' as $$
 select p.id,p.full_name,p.email,p.status::text from public.patients p
 left join public.patient_recent_visits r on r.patient_id=p.id and r.user_id=p_actor
 where public.patient_actor_can_access(p_actor,p.id) and (not p_recent or r.patient_id is not null)
 and (p_search='' or strpos(public.patient_search_text(p.full_name),public.patient_search_text(p_search))>0 or strpos(lower(coalesce(p.email,'')),lower(p_search))>0)
 order by case when p_recent then r.visited_at end desc nulls last,lower(p.full_name),p.id limit 20;
$$;
create or replace function public.agenda_client_choices(p_actor uuid,p_search text,p_offset integer,p_limit integer)
returns table(id uuid,name text,email text) language sql stable security invoker set search_path='' as $$
 select p.id,p.full_name,p.email from public.patients p
 where p.status='active' and p.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and public.patient_actor_can_access(p_actor,p.id)
 and (p_search='' or strpos(public.patient_search_text(p.full_name),public.patient_search_text(p_search))>0 or strpos(lower(p.email),lower(p_search))>0)
 order by lower(p.full_name),p.id offset greatest(0,p_offset) limit least(101,greatest(1,p_limit));
$$;
revoke all on function public.patient_search_text(text),public.search_patient_choices(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.patient_search_text(text),public.search_patient_choices(uuid,text,boolean) to service_role;

create function public.refresh_customer_booking_reminders(p_customer uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare b record;
begin
 for b in select id from public.bookings where customer_user_id=p_customer and status='confirmed' and starts_at>now()+interval '72 hours' loop
   perform public.schedule_booking_reminder(b.id);
 end loop;
end; $$;
revoke all on function public.refresh_customer_booking_reminders(uuid) from public,anon,authenticated;
grant execute on function public.refresh_customer_booking_reminders(uuid) to service_role;

revoke all on function public.sync_patient_booking_account(), public.register_booking_outcome(uuid,uuid,timestamptz,public.booking_status,text,text,uuid),
 public.guard_booking_outcome_time(),public.schedule_booking_reminder(uuid),public.book_new_patient(uuid,uuid,text,text,uuid,timestamptz,date,uuid),public.record_patient_visit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.register_booking_outcome(uuid,uuid,timestamptz,public.booking_status,text,text,uuid),
 public.book_new_patient(uuid,uuid,text,text,uuid,timestamptz,date,uuid),public.record_patient_visit(uuid,uuid),public.schedule_booking_reminder(uuid),public.sync_patient_booking_account(),public.guard_booking_outcome_time() to service_role;


-- Conservative deletion: no care history, appointments or account can be removed here.
create function public.patient_deletion_blocker(p_actor uuid,p_patient uuid) returns text
language plpgsql stable security invoker set search_path='' as $$
declare p public.patients%rowtype;
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'not_allowed' using errcode='42501'; end if;
 select * into p from public.patients where id=p_patient;
 if not found then return 'not_found'; end if;
 if p.status<>'archived' then return 'archive_first'; end if;
 if p.customer_user_id is not null then return 'linked_account'; end if;
 if exists(select 1 from public.bookings where patient_id=p_patient) then return 'appointments'; end if;
 if exists(select 1 from public.patient_notes where patient_id=p_patient) or p.intake_date is not null or p.registration_reason<>'' or p.referrer<>'' then return 'care_data'; end if;
 return null;
end; $$;
create function public.delete_empty_patient(p_actor uuid,p_patient uuid,p_name text,p_reason text,p_request uuid default null) returns void
language plpgsql security invoker set search_path='' as $$
declare p public.patients%rowtype; blocker text;
begin
 -- Serialize with record updates and FK inserts; recheck eligibility inside this transaction.
 select * into p from public.patients where id=p_patient for update;
 blocker:=public.patient_deletion_blocker(p_actor,p_patient);
 if blocker is not null then raise exception 'deletion_blocked: %',blocker using errcode='55000'; end if;
 if p_name is distinct from p.full_name or p_reason is null or p_reason not in ('test','duplicate','incorrect') then raise exception 'confirmation_required' using errcode='22023'; end if;
 delete from public.patients where id=p_patient;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,request_id,metadata)
 values(p_actor,'patient.empty_record_deleted','patient',p_patient::text,p_request,jsonb_build_object('reason',p_reason));
end; $$;
revoke all on function public.patient_deletion_blocker(uuid,uuid),public.delete_empty_patient(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.patient_deletion_blocker(uuid,uuid),public.delete_empty_patient(uuid,uuid,text,text,uuid) to service_role;
