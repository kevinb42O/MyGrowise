-- Customer changes preserve the booking identity and its original duration.
-- Availability excludes only this booking; all other bookings/blocks still apply.
create function public.get_customer_reschedule_slots(p_customer uuid,p_booking uuid,p_days integer default 90)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_state jsonb;
begin
 select b.practitioner_id into v_owner from public.bookings b
 where b.id=p_booking and b.customer_user_id=p_customer and b.status='confirmed';
 if not found then return; end if;
 if practice_private.confirmed_email(p_customer) is null
 or not exists(select 1 from public.user_roles where user_id=p_customer and role='customer')
 or exists(select 1 from public.user_roles where user_id=p_customer and role<>'customer') then return; end if;
 v_state:=practice_private.ensure_mijndiad_fresh(v_owner,60);
 if v_state->>'usable'='false' then raise exception 'external_calendar_unavailable' using errcode='55000'; end if;
 return query
 with selected as (
   select b.id,b.practitioner_id,b.starts_at original_start,
     (extract(epoch from (b.ends_at-b.starts_at))/60)::integer duration,
     s.minimum_notice_hours,s.booking_horizon_days
   from public.bookings b
   join public.practitioner_appointment_types o on o.id=b.offer_id and o.practitioner_id=b.practitioner_id
   join public.appointment_types t on t.id=o.appointment_type_id
   join public.practitioners p on p.id=b.practitioner_id
   join public.practitioner_settings s on s.practitioner_id=p.id
   where b.id=p_booking and b.customer_user_id=p_customer and b.status='confirmed'
     and b.starts_at>now() and b.starts_at>=now()+make_interval(hours=>s.minimum_notice_hours)
     and o.active and o.bookable and t.active and p.active and s.requests_enabled
 ), candidates as (
   select s.*,
     ((d.day::date+r.start_time) at time zone 'Europe/Brussels')+make_interval(mins=>step.n*15) candidate_start,
     ((d.day::date+r.start_time) at time zone 'Europe/Brussels')+make_interval(mins=>step.n*15+s.duration) candidate_end
   from selected s join public.availability_rules r on r.practitioner_id=s.practitioner_id
   cross join lateral generate_series(timezone('Europe/Brussels',now())::date,
     timezone('Europe/Brussels',now())::date+least(greatest(coalesce(p_days,90),1),s.booking_horizon_days),interval '1 day') d(day)
   cross join lateral generate_series(0,floor((extract(epoch from (r.end_time-r.start_time))/60-s.duration)/15)::integer) step(n)
   where extract(isodow from d.day)=r.weekday
 ) select distinct c.candidate_start,c.candidate_end from candidates c
 where c.candidate_start<>c.original_start
   and c.candidate_start>=now()+make_interval(hours=>c.minimum_notice_hours)
   and not exists(select 1 from public.bookings b where b.practitioner_id=c.practitioner_id and b.id<>c.id
     and b.status in ('pending','confirmed') and b.time_range&&tstzrange(c.candidate_start,c.candidate_end,'[)'))
   and not exists(select 1 from public.availability_exceptions e where e.practitioner_id=c.practitioner_id and e.kind='unavailable'
     and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.candidate_start,c.candidate_end,'[)'))
   and not exists(select 1 from public.practice_calendar_events e where e.practitioner_id=c.practitioner_id and e.status='confirmed'
     and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.candidate_start,c.candidate_end,'[)'))
 order by c.candidate_start;
end; $$;

create function public.reschedule_customer_appointment(p_customer uuid,p_booking uuid,p_starts timestamptz,p_previous timestamptz,p_request uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
declare v_booking public.bookings%rowtype; v_end timestamptz; v_notice integer; v_event bigint; v_owner uuid;
begin
 if practice_private.confirmed_email(p_customer) is null
 or not exists(select 1 from public.user_roles where user_id=p_customer and role='customer')
 or exists(select 1 from public.user_roles where user_id=p_customer and role<>'customer') then
   raise exception 'customer_required' using errcode='42501'; end if;
 -- Match the existing booking writer's customer -> practitioner lock order.
 perform pg_advisory_xact_lock(hashtextextended(p_customer::text,1));
 select practitioner_id into v_owner from public.bookings where id=p_booking and customer_user_id=p_customer;
 if not found then raise exception 'booking_not_found' using errcode='P0002'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text,0));
 select * into v_booking from public.bookings where id=p_booking and customer_user_id=p_customer for update;
 if not found or v_booking.status<>'confirmed' then raise exception 'booking_not_found' using errcode='P0002'; end if;
 if p_starts is null or p_previous is null then raise exception 'invalid_reschedule' using errcode='22023'; end if;
 -- Repeated submission after success must not enqueue another notification/mail.
 if v_booking.starts_at=p_starts then return; end if;
 if v_booking.starts_at<>p_previous then raise exception 'booking_changed' using errcode='40001'; end if;
 select minimum_notice_hours into v_notice from public.practitioner_settings where practitioner_id=v_owner;
 if v_booking.starts_at<=now() or v_booking.starts_at<now()+make_interval(hours=>coalesce(v_notice,2)) then
   raise exception 'reschedule_too_late' using errcode='22023'; end if;
 if (select count(*) from public.booking_schedule_events where actor_user_id=p_customer and occurred_at>now()-interval '10 minutes')>=5 then
   raise exception 'reschedule_rate_limited' using errcode='22023'; end if;
 select s.ends_at into v_end from public.get_customer_reschedule_slots(p_customer,p_booking,90) s where s.starts_at=p_starts;
 if v_end is null then raise exception 'slot_unavailable' using errcode='23P01'; end if;
 perform set_config('app.booking_actor_user_id',p_customer::text,true);
 perform set_config('app.booking_request_id',coalesce(p_request::text,''),true);
 update public.bookings set starts_at=p_starts,ends_at=v_end where id=p_booking;
 insert into public.booking_schedule_events(booking_id,old_starts_at,old_ends_at,new_starts_at,new_ends_at,actor_user_id)
 values(p_booking,v_booking.starts_at,v_booking.ends_at,p_starts,v_end,p_customer) returning id into v_event;
 insert into public.customer_notifications(customer_user_id,booking_id,schedule_event_id) values(p_customer,p_booking,v_event);
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,request_id)
 values(p_customer,'booking.rescheduled_by_customer','booking',p_booking::text,p_request);
 -- Existing booking update trigger queues the rescheduled email atomically.
end; $$;
revoke all on function public.get_customer_reschedule_slots(uuid,uuid,integer),public.reschedule_customer_appointment(uuid,uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.get_customer_reschedule_slots(uuid,uuid,integer),public.reschedule_customer_appointment(uuid,uuid,timestamptz,timestamptz,uuid) to service_role;
