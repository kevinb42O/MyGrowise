-- Practice administration and direct, account-linked confirmed appointments.
-- Trusted Astro routes call these invoker functions; no public RPC grants.
create schema if not exists practice_private;
revoke all on schema practice_private from public,anon,authenticated;
grant usage on schema practice_private to service_role;
-- Only this narrow, non-Data-API helper reads Auth's private identity table.
create function practice_private.confirmed_email(p_user uuid) returns text
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is not null and auth.uid()<>p_user then raise exception 'not_allowed' using errcode='42501'; end if;
 return (select lower(email) from auth.users where id=p_user and email_confirmed_at is not null);
end; $$;
create function practice_private.is_invited_user(p_user uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is not null and auth.uid()<>p_user then raise exception 'not_allowed' using errcode='42501'; end if;
 return exists(select 1 from auth.users where id=p_user and invited_at is not null);
end; $$;
revoke all on function practice_private.confirmed_email(uuid),practice_private.is_invited_user(uuid) from public,anon,authenticated;
grant execute on function practice_private.confirmed_email(uuid),practice_private.is_invited_user(uuid) to service_role;

create table public.practice_managers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.practice_managers enable row level security;
revoke all on public.practice_managers from public, anon, authenticated;
grant all on public.practice_managers to service_role;
insert into public.practice_managers(user_id)
select user_id from public.practitioners where slug = 'virginie' and user_id is not null;

create function public.is_practice_manager(p_actor uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin')
 or exists(select 1 from public.practice_managers where user_id=p_actor);
$$;
revoke all on function public.is_practice_manager(uuid) from public, anon, authenticated;
grant execute on function public.is_practice_manager(uuid) to service_role;

alter table public.patients
 add column first_name text not null default '', add column last_name text not null default '',
 add column birth_date date, add column gender text not null default '',
 add column salutation text not null default '', add column intake_date date,
 add column street text not null default '', add column house_number text not null default '',
 add column address_box text not null default '', add column postal_code text not null default '',
 add column city text not null default '', add column country text not null default 'BE',
 add column mobile text not null default '', add column national_number text not null default '',
 add column registration_reason text not null default '', add column referrer text not null default '';
alter table public.patients add constraint patients_extended_fields check (
 char_length(first_name)<=60 and char_length(last_name)<=60 and char_length(street)<=150
 and char_length(house_number)<=20 and char_length(address_box)<=20 and char_length(postal_code)<=20
 and char_length(city)<=100 and country ~ '^[A-Z]{2}$' and char_length(mobile)<=35
 and (national_number='' or national_number ~ '^[0-9]{11}$')
 and gender in ('','female','male','other','unspecified')
 and salutation in ('','mevrouw','meneer','heer')
 and char_length(registration_reason)<=3000 and char_length(referrer)<=300
);
alter table public.practitioners add column image_url text not null default '',
 add column online_instructions text not null default 'Je therapeut bezorgt je de praktische informatie voor de online sessie.';

create table public.treatment_groups (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 color text not null check(color ~ '^#[0-9a-fA-F]{6}$'),
 constraint treatment_group_name check(char_length(trim(name)) between 2 and 80)
);
create table public.appointment_types (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null check(char_length(trim(name)) between 2 and 120),
 treatment_group_id uuid not null references public.treatment_groups(id),
 session_kind text not null check(session_kind in ('intake','follow_up','other')),
 channel text not null default 'online' check(channel in ('online','in_person')),
 location text not null default '' check(char_length(location)<=200),
 duration_minutes integer not null default 60 check(duration_minutes between 15 and 240 and duration_minutes%5=0),
 active boolean not null default true, updated_at timestamptz not null default now(),
 check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
create table public.practitioner_appointment_types (
 id uuid primary key default gen_random_uuid(),
 practitioner_id uuid not null references public.practitioners(id),
 appointment_type_id uuid not null references public.appointment_types(id),
 duration_minutes integer check(duration_minutes between 15 and 240 and duration_minutes%5=0),
 bookable boolean not null default true, active boolean not null default true,
 unique(practitioner_id,appointment_type_id)
);
create index practitioner_appointment_types_type_idx on public.practitioner_appointment_types(appointment_type_id);
create index appointment_types_group_idx on public.appointment_types(treatment_group_id);
alter table public.treatment_groups enable row level security;
alter table public.appointment_types enable row level security;
alter table public.practitioner_appointment_types enable row level security;
revoke all on public.treatment_groups,public.appointment_types,public.practitioner_appointment_types from public,anon,authenticated;
grant all on public.treatment_groups,public.appointment_types,public.practitioner_appointment_types to service_role;

insert into public.treatment_groups(name,color) values
 ('EMDR','#7c3aed'),('Psychotherapie','#2563eb'),('Hypnose','#15803d'),('Seksuologie','#be123c'),('Psychologie','#0891b2');
insert into public.appointment_types(slug,name,treatment_group_id,session_kind)
select seed.slug,seed.name,g.id,seed.kind from (values
 ('intake-emdr-online','Intake EMDR – online','EMDR','intake'),
 ('emdr-sessie-online','EMDR-sessie – online','EMDR','follow_up'),
 ('intake-psychotherapie-online','Intake psychotherapie – online','Psychotherapie','intake'),
 ('psychotherapiesessie-online','Psychotherapiesessie – online','Psychotherapie','follow_up'),
 ('intake-hypnose-online','Intake hypnose – online','Hypnose','intake'),
 ('hypnosesessie-online','Hypnosesessie – online','Hypnose','follow_up'),
 ('intake-hypnose-stoppen-met-roken-online','Intake hypnose stoppen met roken – online','Hypnose','intake'),
 ('hypnose-stoppen-met-roken-online','Hypnose stoppen met roken – online','Hypnose','follow_up'),
 ('intake-seksuoloog-online','Intake seksuoloog – online','Seksuologie','intake'),
 ('seksuoloog-sessie-online','Seksuoloog sessie – online','Seksuologie','follow_up'),
 ('intake-psycholoog-online','Intake psycholoog – online','Psychologie','intake'),
 ('psychologiesessie-online','Psychologiesessie – online','Psychologie','follow_up')
) seed(slug,name,group_name,kind) join public.treatment_groups g on g.name=seed.group_name;
insert into public.practitioner_appointment_types(practitioner_id,appointment_type_id,duration_minutes)
select p.id,t.id,s.appointment_duration_minutes from public.practitioners p
join public.practitioner_settings s on s.practitioner_id=p.id
cross join public.appointment_types t join public.treatment_groups g on g.id=t.treatment_group_id
where (p.slug='virginie' and g.name in ('EMDR','Psychotherapie','Hypnose'))
 or (p.slug='amy' and g.name='Seksuologie') or (p.slug='margot' and g.name in ('EMDR','Psychologie'));

alter table public.bookings
 add column offer_id uuid references public.practitioner_appointment_types(id),
 add column appointment_name text not null default 'Afspraaktype nog te bepalen',
 add column session_kind text check(session_kind in ('intake','follow_up','other')),
 add column channel text not null default 'online', add column location text not null default '',
 add column instructions text not null default '', add column registration_reason text not null default '';
create index bookings_offer_idx on public.bookings(offer_id) where offer_id is not null;

create function public.save_patient_details(p_actor uuid,p_patient uuid,p_details jsonb,p_expected timestamptz default null)
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
 mobile=coalesce(p_details->>'mobile',''),national_number=coalesce(p_details->>'national_number',''),
 registration_reason=case when v_customer and registration_reason<>'' then registration_reason else coalesce(p_details->>'registration_reason','') end,
 referrer=case when v_customer and referrer<>'' then referrer else coalesce(p_details->>'referrer','') end,
 email=case when v_customer then email else nullif(lower(trim(p_details->>'email')),'') end
 where id=p_patient;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id) values(p_actor,'patient.details_updated','patient',p_patient::text);
end; $$;
revoke all on function public.save_patient_details(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.save_patient_details(uuid,uuid,jsonb,timestamptz) to service_role;

create function public.get_offer_slots(p_offer uuid,p_days integer default 30)
returns table(practitioner_id uuid,starts_at timestamptz,ends_at timestamptz)
language sql stable security invoker set search_path='' as $$
 with selected as (
 select p.id,coalesce(o.duration_minutes,t.duration_minutes) duration,s.minimum_notice_hours,s.booking_horizon_days
 from public.practitioner_appointment_types o join public.appointment_types t on t.id=o.appointment_type_id
 join public.practitioners p on p.id=o.practitioner_id join public.practitioner_settings s on s.practitioner_id=p.id
 where o.id=p_offer and o.active and o.bookable and t.active and p.active and s.requests_enabled
 ), candidates as (
 select p.id,
 ((d.day::date+r.start_time) at time zone 'Europe/Brussels')+make_interval(mins=>step.n*15) starts_at,
 ((d.day::date+r.start_time) at time zone 'Europe/Brussels')+make_interval(mins=>step.n*15+p.duration) ends_at
 from selected p join public.availability_rules r on r.practitioner_id=p.id
 cross join lateral generate_series(timezone('Europe/Brussels',now())::date,
 timezone('Europe/Brussels',now())::date+least(greatest(coalesce(p_days,30),1),p.booking_horizon_days),interval '1 day') d(day)
 cross join lateral generate_series(0,floor((extract(epoch from (r.end_time-r.start_time))/60-p.duration)/15)::int) step(n)
 where extract(isodow from d.day)=r.weekday
 ) select distinct c.id,c.starts_at,c.ends_at from candidates c join selected p on p.id=c.id
 where c.starts_at>=now()+make_interval(hours=>p.minimum_notice_hours)
 and not exists(select 1 from public.bookings b where b.practitioner_id=c.id and b.status in ('pending','confirmed') and b.time_range&&tstzrange(c.starts_at,c.ends_at,'[)'))
 and not exists(select 1 from public.availability_exceptions e where e.practitioner_id=c.id and e.kind='unavailable' and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.starts_at,c.ends_at,'[)'))
 and not exists(select 1 from public.practice_calendar_events e where e.practitioner_id=c.id and e.status='confirmed' and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.starts_at,c.ends_at,'[)'))
 order by c.starts_at;
$$;
revoke all on function public.get_offer_slots(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_offer_slots(uuid,integer) to service_role;

create function public.book_customer_appointment(p_customer uuid,p_offer uuid,p_starts timestamptz,p_key uuid,p_details jsonb,p_request uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_offer record; v_patient public.patients%rowtype; v_existing public.bookings%rowtype;
 v_email text; v_id uuid; v_end timestamptz;
begin
 if not exists(select 1 from public.user_roles where user_id=p_customer and role='customer')
 or exists(select 1 from public.user_roles where user_id=p_customer and role<>'customer') then raise exception 'customer_required' using errcode='42501'; end if;
 v_email:=practice_private.confirmed_email(p_customer);
 if v_email is null then raise exception 'email_confirmation' using errcode='28000'; end if;
 if p_key is null or p_starts is null then raise exception 'invalid_input' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_customer::text,1));
 select * into v_existing from public.bookings where submission_key=p_key;
 if found then
   if v_existing.customer_user_id=p_customer and v_existing.offer_id=p_offer and v_existing.starts_at=p_starts then return v_existing.id; end if;
   raise exception 'idempotency_conflict' using errcode='23505';
 end if;
 if (select count(*) from public.bookings where customer_user_id=p_customer and origin='customer_request' and created_at>now()-interval '10 minutes')>=5 then raise exception 'rate_limited' using errcode='22023'; end if;
 select o.*,t.name,t.session_kind,t.channel,t.location,coalesce(o.duration_minutes,t.duration_minutes) duration,
 p.online_instructions,p.user_id into v_offer from public.practitioner_appointment_types o
 join public.appointment_types t on t.id=o.appointment_type_id join public.practitioners p on p.id=o.practitioner_id
 where o.id=p_offer and o.active and o.bookable and t.active and p.active for share of o,t,p;
 if not found then raise exception 'offer_unavailable' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_offer.practitioner_id::text,0));
 select s.ends_at into v_end from public.get_offer_slots(p_offer,90) s where s.starts_at=p_starts;
 if v_end is null then raise exception 'slot_unavailable' using errcode='23P01'; end if;
 select * into v_patient from public.patients where customer_user_id=p_customer for update;
 if not found then
   if exists(select 1 from public.patients where lower(email)=v_email and customer_user_id is null) then raise exception 'identity_review_required' using errcode='22023'; end if;
   insert into public.patients(full_name,email,customer_user_id,created_by)
   values(trim(p_details->>'first_name')||' '||trim(p_details->>'last_name'),v_email,p_customer,p_customer) returning * into v_patient;
 end if;
 if v_patient.status<>'active' then raise exception 'patient_archived' using errcode='22023'; end if;
 perform public.save_patient_details(p_customer,v_patient.id,p_details);
 update public.patients set email=v_email where id=v_patient.id;
 if nullif(p_details->>'birth_date','') is null or nullif(p_details->>'mobile','') is null then raise exception 'invalid_input' using errcode='22023'; end if;
 if v_offer.user_id is not null then
 insert into public.patient_assignments(patient_id,user_id,assigned_by) values(v_patient.id,v_offer.user_id,p_customer)
 on conflict(patient_id,user_id) where ended_at is null do nothing;
 end if;
 perform set_config('app.booking_actor_user_id',p_customer::text,true);
 perform set_config('app.booking_request_id',coalesce(p_request::text,''),true);
 insert into public.bookings(practitioner_id,patient_id,customer_user_id,client_name,client_email,starts_at,ends_at,status,calendar_booked_at,submission_key,offer_id,appointment_name,session_kind,channel,location,instructions,registration_reason)
 values(v_offer.practitioner_id,v_patient.id,p_customer,trim(p_details->>'first_name')||' '||trim(p_details->>'last_name'),v_email,p_starts,v_end,'confirmed',now(),p_key,p_offer,v_offer.name,v_offer.session_kind,v_offer.channel,v_offer.location,v_offer.online_instructions,coalesce(p_details->>'registration_reason','')) returning id into v_id;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,request_id) values(p_customer,'booking.confirmed_online','booking',v_id::text,p_request);
 return v_id;
end; $$;
revoke all on function public.book_customer_appointment(uuid,uuid,timestamptz,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.book_customer_appointment(uuid,uuid,timestamptz,uuid,jsonb,uuid) to service_role;
-- Historical requests stay intact. Old service-only RPCs remain compatible
-- during schema-first deployment; the new application exclusively uses typed booking.

create function public.save_appointment_type(p_actor uuid,p_data jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_group uuid; v_slug text;
begin
 if not public.is_practice_manager(p_actor) then raise exception 'not_allowed' using errcode='42501'; end if;
 v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 v_group:=nullif(p_data->>'group_id','')::uuid;
 if exists(select 1 from public.bookings b join public.practitioner_appointment_types o on o.id=b.offer_id where o.appointment_type_id=v_id)
 and exists(select 1 from public.appointment_types t where t.id=v_id and (t.treatment_group_id is distinct from v_group or t.session_kind is distinct from p_data->>'session_kind' or t.channel is distinct from p_data->>'channel')) then
 raise exception 'used_type_identity_change' using errcode='22023'; end if;
 if v_group is null then
   insert into public.treatment_groups(name,color) values(trim(p_data->>'group_name'),p_data->>'color') returning id into v_group;
 else
   update public.treatment_groups set color=p_data->>'color' where id=v_group;
   if not found then raise exception 'invalid_group' using errcode='22023'; end if;
 end if;
 v_slug:=coalesce((select slug from public.appointment_types where id=v_id), 'type-'||v_id::text);
 insert into public.appointment_types(id,slug,name,treatment_group_id,session_kind,channel,location,duration_minutes,active)
 values(v_id,v_slug,trim(p_data->>'name'),v_group,p_data->>'session_kind',p_data->>'channel',coalesce(p_data->>'location',''),(p_data->>'duration_minutes')::int,coalesce((p_data->>'active')::boolean,true))
 on conflict(id) do update set name=excluded.name,treatment_group_id=excluded.treatment_group_id,session_kind=excluded.session_kind,channel=excluded.channel,location=excluded.location,duration_minutes=excluded.duration_minutes,active=excluded.active,updated_at=now();
 update public.practitioner_appointment_types set active=false where appointment_type_id=v_id;
 insert into public.practitioner_appointment_types(practitioner_id,appointment_type_id,duration_minutes,active,bookable)
 select (item->>'practitioner_id')::uuid,v_id,nullif(item->>'duration_minutes','')::int,true,coalesce((item->>'bookable')::boolean,true)
 from jsonb_array_elements(coalesce(p_data->'offers','[]')) item
 on conflict(practitioner_id,appointment_type_id) do update set active=true,duration_minutes=excluded.duration_minutes,bookable=excluded.bookable;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id) values(p_actor,'appointment_type.saved','appointment_type',v_id::text);
 return v_id;
end; $$;
revoke all on function public.save_appointment_type(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_appointment_type(uuid,jsonb) to service_role;

create function public.save_practice_practitioner(p_actor uuid,p_data jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_user uuid; v_rule jsonb;
begin
 if not public.is_practice_manager(p_actor) then raise exception 'not_allowed' using errcode='42501'; end if;
 v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 v_user:=nullif(p_data->>'user_id','')::uuid;
 if v_user is not null and (not exists(select 1 from public.user_roles where user_id=v_user and role in ('employee','practitioner','super_admin'))
 or exists(select 1 from public.user_roles where user_id=v_user and role='customer')) then raise exception 'invalid_staff_account' using errcode='22023'; end if;
 if exists(select 1 from public.practitioners where id=v_id and user_id is not null and user_id is distinct from v_user) then raise exception 'account_link_immutable' using errcode='22023'; end if;
 insert into public.practitioners(id,user_id,slug,name,public_role,bio,expertise,languages,active,image_url,online_instructions)
 values(v_id,v_user,p_data->>'slug',p_data->>'name',coalesce(p_data->>'public_role',''),coalesce(p_data->>'bio',''),array(select jsonb_array_elements_text(coalesce(p_data->'expertise','[]'))),array(select jsonb_array_elements_text(coalesce(p_data->'languages','[]'))),coalesce((p_data->>'active')::boolean,false),coalesce(p_data->>'image_url',''),coalesce(p_data->>'online_instructions',''))
 on conflict(id) do update set user_id=excluded.user_id,name=excluded.name,public_role=excluded.public_role,bio=excluded.bio,expertise=excluded.expertise,languages=excluded.languages,active=excluded.active,image_url=excluded.image_url,online_instructions=excluded.online_instructions;
 if v_user is not null then insert into public.user_roles(user_id,role) values(v_user,'practitioner') on conflict do nothing; end if;
 insert into public.practitioner_settings(practitioner_id,minimum_notice_hours,booking_horizon_days,requests_enabled)
 values(v_id,(p_data->>'minimum_notice_hours')::int,(p_data->>'booking_horizon_days')::int,coalesce((p_data->>'requests_enabled')::boolean,false))
 on conflict(practitioner_id) do update set minimum_notice_hours=excluded.minimum_notice_hours,booking_horizon_days=excluded.booking_horizon_days,requests_enabled=excluded.requests_enabled;
 delete from public.availability_rules where practitioner_id=v_id;
 for v_rule in select * from jsonb_array_elements(coalesce(p_data->'rules','[]')) loop
   if exists(select 1 from public.availability_rules where practitioner_id=v_id and weekday=(v_rule->>'weekday')::int and start_time<(v_rule->>'end_time')::time and end_time>(v_rule->>'start_time')::time) then raise exception 'overlapping_availability' using errcode='22023'; end if;
   insert into public.availability_rules(practitioner_id,weekday,start_time,end_time) values(v_id,(v_rule->>'weekday')::int,(v_rule->>'start_time')::time,(v_rule->>'end_time')::time);
 end loop;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id) values(p_actor,'practitioner.saved','practitioner',v_id::text);
 return v_id;
end; $$;
revoke all on function public.save_practice_practitioner(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_practice_practitioner(uuid,jsonb) to service_role;

create function public.create_typed_staff_booking(p_actor uuid,p_patient uuid,p_offer uuid,p_starts timestamptz,p_request uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_offer record; v_patient public.patients%rowtype; v_id uuid;
begin
 select o.*,t.name,t.session_kind,t.channel,t.location,coalesce(o.duration_minutes,t.duration_minutes) duration,p.online_instructions,p.user_id
 into v_offer from public.practitioner_appointment_types o join public.appointment_types t on t.id=o.appointment_type_id join public.practitioners p on p.id=o.practitioner_id
 where o.id=p_offer and o.active and t.active and p.active for share of o,t,p;
 if not found or (not public.is_practice_manager(p_actor) and v_offer.user_id is distinct from p_actor) then raise exception 'not_allowed' using errcode='42501'; end if;
 if not public.patient_actor_can_access(p_actor,p_patient) then raise exception 'not_allowed' using errcode='42501'; end if;
 select * into v_patient from public.patients where id=p_patient and status='active';
 if not found or v_patient.email is null or p_starts is null or p_starts<=now() then raise exception 'invalid_input' using errcode='22023'; end if;
 if v_offer.user_id is not null then
 insert into public.patient_assignments(patient_id,user_id,assigned_by) values(p_patient,v_offer.user_id,p_actor)
 on conflict(patient_id,user_id) where ended_at is null do nothing;
 end if;
 perform set_config('app.booking_actor_user_id',p_actor::text,true);
 perform set_config('app.booking_request_id',coalesce(p_request::text,''),true);
 insert into public.bookings(practitioner_id,patient_id,customer_user_id,client_name,client_email,starts_at,ends_at,status,origin,calendar_booked_at,offer_id,appointment_name,session_kind,channel,location,instructions)
 values(v_offer.practitioner_id,p_patient,v_patient.customer_user_id,v_patient.full_name,v_patient.email,p_starts,p_starts+make_interval(mins=>v_offer.duration),'confirmed','staff',now(),p_offer,v_offer.name,v_offer.session_kind,v_offer.channel,v_offer.location,v_offer.online_instructions) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.create_typed_staff_booking(uuid,uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.create_typed_staff_booking(uuid,uuid,uuid,timestamptz,uuid) to service_role;
-- The old staff RPC remains service-only during the coordinated application rollout.

create function public.enforce_typed_booking_duration() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.offer_id is not null and new.ends_at-new.starts_at<>old.ends_at-old.starts_at then raise exception 'appointment_duration_fixed' using errcode='22023'; end if;
 return new;
end; $$;
create trigger bookings_keep_duration before update of starts_at,ends_at on public.bookings for each row execute function public.enforce_typed_booking_duration();
revoke all on function public.enforce_typed_booking_duration() from public,anon,authenticated;

create table public.booking_mail_jobs (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
 event_key text not null unique, kind text not null check(kind in ('confirmation','rescheduled','cancelled')),
 recipient text not null, payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','suppressed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz, last_error text, sent_at timestamptz, created_at timestamptz not null default now()
);
create index booking_mail_jobs_booking_idx on public.booking_mail_jobs(booking_id,created_at desc);
create index booking_mail_jobs_pending_idx on public.booking_mail_jobs(next_attempt_at) where status in ('pending','sending');
alter table public.booking_mail_jobs enable row level security;
revoke all on public.booking_mail_jobs from public,anon,authenticated;
grant all on public.booking_mail_jobs to service_role;
create function public.enqueue_booking_mail(p_booking uuid,p_kind text,p_key text) returns void
language sql security invoker set search_path='' as $$
 insert into public.booking_mail_jobs(booking_id,event_key,kind,recipient,status,payload)
 select b.id,p_key,p_kind,b.client_email,case when coalesce(pref.booking_email_enabled,true) then 'pending' else 'suppressed' end,jsonb_build_object('name',b.client_name,'salutation',coalesce(patient.salutation,''),
 'appointment',b.appointment_name,'practitioner',p.name,'startsAt',b.starts_at,'endsAt',b.ends_at,'channel',b.channel,'location',b.location,'instructions',b.instructions)
 from public.bookings b join public.practitioners p on p.id=b.practitioner_id left join public.patients patient on patient.id=b.patient_id left join public.user_preferences pref on pref.user_id=b.customer_user_id
 where b.id=p_booking on conflict(event_key) do nothing;
$$;
revoke all on function public.enqueue_booking_mail(uuid,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_booking_mail(uuid,text,text) to service_role;

create function public.booking_mail_and_intake_event() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
   if new.status='confirmed' then perform public.enqueue_booking_mail(new.id,'confirmation','confirmed:'||new.id::text); end if;
 else
   if new.status='confirmed' and old.status='pending' then perform public.enqueue_booking_mail(new.id,'confirmation','confirmed:'||new.id::text);
   elsif new.status='cancelled' and old.status is distinct from new.status then
     perform public.enqueue_booking_mail(new.id,'cancelled','cancelled:'||new.id::text);
   elsif new.status='confirmed' and new.starts_at is distinct from old.starts_at then
     perform public.enqueue_booking_mail(new.id,'rescheduled','rescheduled:'||new.id::text||':'||gen_random_uuid()::text);
   end if;
   if new.status='completed' and new.session_kind='intake' then
     update public.patients set intake_date=(new.starts_at at time zone 'Europe/Brussels')::date
     where id=new.patient_id and (intake_date is null or intake_date>(new.starts_at at time zone 'Europe/Brussels')::date);
   end if;
 end if;
 return new;
end; $$;
create trigger bookings_queue_mail after insert or update of status,starts_at on public.bookings for each row execute function public.booking_mail_and_intake_event();
revoke all on function public.booking_mail_and_intake_event() from public,anon,authenticated;

create function public.claim_booking_mail(p_limit integer default 10,p_booking uuid default null)
returns setof public.booking_mail_jobs language sql security invoker set search_path='' as $$
 with expired as (update public.booking_mail_jobs set status='failed',lease_until=null,last_error='lease_expired' where status='sending' and lease_until<now() and attempts>=6 returning id), eligible as (
 select id from public.booking_mail_jobs where (p_booking is null or booking_id=p_booking) and attempts<6
 and ((status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now()))
 order by created_at for update skip locked limit least(greatest(p_limit,1),20)
 ) update public.booking_mail_jobs j set status='sending',attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 from eligible e where j.id=e.id returning j.*;
$$;
revoke all on function public.claim_booking_mail(integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_booking_mail(integer,uuid) to service_role;

create function public.retry_booking_mail(p_actor uuid,p_job uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_job public.booking_mail_jobs%rowtype; v_user uuid; v_id uuid;
begin
 select j.* into v_job from public.booking_mail_jobs j where j.id=p_job for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 select p.user_id into v_user from public.bookings b join public.practitioners p on p.id=b.practitioner_id where b.id=v_job.booking_id;
 if not public.is_practice_manager(p_actor) and v_user is distinct from p_actor then raise exception 'not_allowed' using errcode='42501'; end if;
 if v_job.status='sending' and v_job.lease_until>now() then raise exception 'mail_in_progress' using errcode='22023'; end if;
 if v_job.status in ('failed','pending','sending') then
 update public.booking_mail_jobs set status='pending',attempts=0,next_attempt_at=now(),lease_token=null,lease_until=null,last_error=null where id=p_job;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id) values(p_actor,'booking.mail_retry','booking',v_job.booking_id::text);
 return p_job;
 end if;
 insert into public.booking_mail_jobs(booking_id,event_key,kind,recipient,payload)
 values(v_job.booking_id,'resend:'||gen_random_uuid()::text,v_job.kind,v_job.recipient,v_job.payload) returning id into v_id;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id) values(p_actor,'booking.mail_resent','booking',v_job.booking_id::text);
 return v_id;
end; $$;
revoke all on function public.retry_booking_mail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_booking_mail(uuid,uuid) to service_role;

create function public.link_practitioner_invitation(p_actor uuid,p_practitioner uuid,p_user uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_practice_manager(p_actor) then raise exception 'not_allowed' using errcode='42501'; end if;
 perform 1 from public.practitioners where id=p_practitioner and user_id is null for update;
 if not found then raise exception 'account_already_linked' using errcode='22023'; end if;
 if not practice_private.is_invited_user(p_user)
 or exists(select 1 from public.orders where customer_user_id=p_user)
 or exists(select 1 from public.bookings where customer_user_id=p_user)
 or exists(select 1 from public.user_roles where user_id=p_user and role not in ('customer','practitioner')) then raise exception 'invalid_invitation' using errcode='22023'; end if;
 delete from public.user_roles where user_id=p_user and role='customer';
 insert into public.user_roles(user_id,role) values(p_user,'practitioner') on conflict do nothing;
 update public.practitioners set user_id=p_user where id=p_practitioner;
 insert into public.patient_assignments(patient_id,user_id,assigned_by)
 select distinct patient_id,p_user,p_actor from public.bookings where practitioner_id=p_practitioner and patient_id is not null and status in ('confirmed','completed','no_show')
 on conflict(patient_id,user_id) where ended_at is null do nothing;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id) values(p_actor,'practitioner.account_invited','practitioner',p_practitioner::text);
end; $$;
revoke all on function public.link_practitioner_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.link_practitioner_invitation(uuid,uuid,uuid) to service_role;

create function public.reschedule_practice_appointment(p_actor uuid,p_booking uuid,p_starts timestamptz,p_request uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
declare v_booking public.bookings%rowtype; v_user uuid; v_event bigint; v_end timestamptz;
begin
 select * into v_booking from public.bookings where id=p_booking for update;
 select user_id into v_user from public.practitioners where id=v_booking.practitioner_id;
 if not found or (not public.is_practice_manager(p_actor) and v_user is distinct from p_actor) then raise exception 'not_allowed' using errcode='42501'; end if;
 if v_booking.status<>'confirmed' or v_booking.starts_at<=now() or p_starts is null or p_starts<=now() or p_starts=v_booking.starts_at then raise exception 'invalid_reschedule' using errcode='22023'; end if;
 v_end:=p_starts+(v_booking.ends_at-v_booking.starts_at);
 update public.bookings set starts_at=p_starts,ends_at=v_end where id=p_booking;
 insert into public.booking_schedule_events(booking_id,old_starts_at,old_ends_at,new_starts_at,new_ends_at,actor_user_id)
 values(p_booking,v_booking.starts_at,v_booking.ends_at,p_starts,v_end,p_actor) returning id into v_event;
 if v_booking.customer_user_id is not null then insert into public.customer_notifications(customer_user_id,booking_id,schedule_event_id) values(v_booking.customer_user_id,p_booking,v_event); end if;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,request_id) values(p_actor,'booking.rescheduled','booking',p_booking::text,p_request);
end; $$;
revoke all on function public.reschedule_practice_appointment(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.reschedule_practice_appointment(uuid,uuid,timestamptz,uuid) to service_role;

create or replace function public.transition_booking_status(
  p_booking_id uuid,
  p_actor_user_id uuid,
  p_next_status public.booking_status,
  p_request_id uuid default null,
  p_request_path text default null
)
returns public.booking_status
language plpgsql
security invoker
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
  ) or public.is_practice_manager(p_actor_user_id) into v_can_manage_all;
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
