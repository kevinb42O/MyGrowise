-- Serialize calendar actions with customer changes, and check the revision
-- while holding the booking row lock.
create function public.agenda_staff_booking_change(
  p_actor uuid, p_booking uuid, p_practitioner uuid, p_revision timestamptz,
  p_status public.booking_status, p_starts timestamptz, p_request uuid, p_path text
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_booking public.bookings%rowtype; v_owner uuid;
begin
  select practitioner_id into v_owner from public.bookings where id = p_booking
    and (p_practitioner is null or p_practitioner = practitioner_id);
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text,0));
  select * into v_booking from public.bookings where id = p_booking and practitioner_id = v_owner for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_revision is not null and p_revision is distinct from v_booking.updated_at then
    raise exception 'agenda_changed' using errcode = '40001';
  end if;
  if p_status is not null then
    perform public.transition_booking_status(p_booking, p_actor, p_status, p_request, p_path);
  else
    perform public.reschedule_practice_appointment(p_actor, p_booking, p_starts, p_request);
  end if;
end;
$$;
revoke all on function public.agenda_staff_booking_change(uuid,uuid,uuid,timestamptz,public.booking_status,timestamptz,uuid,text) from public, anon, authenticated;
grant execute on function public.agenda_staff_booking_change(uuid,uuid,uuid,timestamptz,public.booking_status,timestamptz,uuid,text) to service_role;

alter table public.booking_mail_jobs drop constraint booking_mail_jobs_status_check;
alter table public.booking_mail_jobs add constraint booking_mail_jobs_status_check
  check (status in ('pending','sending','sent','failed','suppressed','superseded'));

create function public.booking_mail_is_current(p_job uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce((select case
    when j.kind = 'cancelled' then b.status = 'cancelled'
    else b.status in ('confirmed','completed','no_show')
      and (j.payload->>'startsAt')::timestamptz = b.starts_at
      and (j.payload->>'endsAt')::timestamptz = b.ends_at
    end
    from public.booking_mail_jobs j join public.bookings b on b.id = j.booking_id
    where j.id = p_job and j.status not in ('suppressed','superseded')), false);
$$;

-- In-flight messages retain their lease. Subsequent messages for that booking
-- wait for the active lease, preserving send order even during a reschedule.
create function public.supersede_booking_mail()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.booking_mail_jobs j set status = 'superseded', lease_token = null, lease_until = null
  where j.booking_id = new.id and j.kind <> 'cancelled' and j.status in ('pending','failed');
  return new;
end;
$$;
create trigger bookings_00_supersede_mail before update of status, starts_at on public.bookings
for each row when ((new.status = 'cancelled' and new.status is distinct from old.status)
  or new.starts_at is distinct from old.starts_at)
execute function public.supersede_booking_mail();

update public.booking_mail_jobs j set status = 'superseded', lease_token = null, lease_until = null
where j.status in ('pending','failed') and not public.booking_mail_is_current(j.id);

create or replace function public.claim_booking_mail(p_limit integer default 10,p_booking uuid default null)
returns setof public.booking_mail_jobs language plpgsql security invoker set search_path = '' as $$
declare v_job public.booking_mail_jobs%rowtype;
begin
  p_limit := least(greatest(coalesce(p_limit,10),1),20);
  update public.booking_mail_jobs j set status = 'superseded', lease_token = null, lease_until = null
  where (p_booking is null or j.booking_id = p_booking)
    and (j.status = 'pending' or (j.status = 'sending' and j.lease_until <= now()))
    and not public.booking_mail_is_current(j.id);
  update public.booking_mail_jobs set status='failed',lease_until=null,last_error='lease_expired'
  where status='sending' and lease_until<=now() and attempts>=6;
  for v_job in
    select j.* from public.booking_mail_jobs j
    where (p_booking is null or j.booking_id=p_booking) and j.attempts<6
      and ((j.status='pending' and j.next_attempt_at<=now()) or (j.status='sending' and j.lease_until<=now()))
      and not exists(select 1 from public.booking_mail_jobs active where active.booking_id=j.booking_id
        and active.status='sending' and active.lease_until>now())
      and public.booking_mail_is_current(j.id)
    order by j.created_at,j.id for update of j skip locked
  loop
    if pg_try_advisory_xact_lock(hashtextextended(v_job.booking_id::text,2)) and
      not exists (select 1 from public.booking_mail_jobs active where active.booking_id=v_job.booking_id
        and active.status='sending' and active.lease_until>now()) then
      return query update public.booking_mail_jobs j set status='sending', attempts=j.attempts+1,
        lease_token=gen_random_uuid(), lease_until=now()+interval '5 minutes'
        where j.id=v_job.id returning j.*;
      p_limit := coalesce(p_limit,10)-1;
      exit when p_limit <= 0;
    end if;
  end loop;
end;
$$;

revoke all on function public.booking_mail_is_current(uuid), public.supersede_booking_mail() from public, anon, authenticated;
grant execute on function public.booking_mail_is_current(uuid) to service_role;

create or replace function public.retry_booking_mail(p_actor uuid,p_job uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_job public.booking_mail_jobs%rowtype; v_user uuid; v_id uuid;
begin
 select j.* into v_job from public.booking_mail_jobs j where j.id=p_job for update;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 select p.user_id into v_user from public.bookings b join public.practitioners p on p.id=b.practitioner_id where b.id=v_job.booking_id;
 if not public.is_practice_manager(p_actor) and v_user is distinct from p_actor then raise exception 'not_allowed' using errcode='42501'; end if;
 if not public.booking_mail_is_current(p_job) then raise exception 'mail_superseded' using errcode='22023'; end if;
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
