-- Keep future reminders eligible without allowing early sending.
-- Relevance (still belongs to the appointment) differs from send readiness.
create or replace function public.booking_mail_is_relevant(p_job uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select case
   when j.kind='cancelled' then b.status='cancelled'
   when j.kind='reminder' then b.status='confirmed' and b.starts_at>now()
     and (j.payload->>'startsAt')::timestamptz=b.starts_at
     and now()<=j.scheduled_for+interval '15 minutes'
     and coalesce(pref.booking_reminder_enabled,true)
   else b.status='confirmed' and b.ends_at>now()
     and (j.payload->>'startsAt')::timestamptz=b.starts_at and (j.payload->>'endsAt')::timestamptz=b.ends_at
   end from public.booking_mail_jobs j join public.bookings b on b.id=j.booking_id
   left join public.user_preferences pref on pref.user_id=b.customer_user_id
   where j.id=p_job and j.status not in ('suppressed','superseded')),false);
$$;
revoke all on function public.booking_mail_is_relevant(uuid) from public,anon,authenticated;
grant execute on function public.booking_mail_is_relevant(uuid) to service_role;

create or replace function public.booking_mail_is_current(p_job uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select public.booking_mail_is_relevant(p_job) and coalesce((
   select j.kind<>'reminder' or j.scheduled_for<=now()
   from public.booking_mail_jobs j where j.id=p_job
 ),false);
$$;

create or replace function public.claim_booking_mail(p_limit integer default 10,p_booking uuid default null)
returns setof public.booking_mail_jobs language plpgsql security invoker set search_path = '' as $$
declare v_job public.booking_mail_jobs%rowtype;
begin
  p_limit := least(greatest(coalesce(p_limit,10),1),20);
  update public.booking_mail_jobs j set status = 'superseded', lease_token = null, lease_until = null
  where (p_booking is null or j.booking_id = p_booking)
    and (j.status = 'pending' or (j.status = 'sending' and j.lease_until <= now()))
    and not public.booking_mail_is_relevant(j.id);
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

-- Restore only never-attempted, exact future reminders for unchanged confirmed
-- appointments. Do not revive suppressed, sent, expired or old rescheduled mail.
update public.booking_mail_jobs j
set status='pending',next_attempt_at=j.scheduled_for,lease_token=null,lease_until=null,last_error=null
from public.bookings b
left join public.user_preferences pref on pref.user_id=b.customer_user_id
where b.id=j.booking_id and j.kind='reminder' and j.status='superseded'
 and j.attempts=0 and j.sent_at is null and j.scheduled_for>now()
 and b.status='confirmed' and coalesce(pref.booking_reminder_enabled,true)
 and (j.payload->>'startsAt')::timestamptz=b.starts_at
 and j.scheduled_for=b.starts_at-interval '72 hours'
 and j.event_key='reminder:'||b.id::text||':'||extract(epoch from b.starts_at)::text;

-- Bound the minute job's operational logs; no Vercel call or paid scheduler.
select cron.schedule('mygrowise-reminder-log-retention','45 3 * * *',
 $job$delete from cron.job_run_details
 where jobid in (select jobid from cron.job where jobname in
 ('mygrowise-booking-reminders','mygrowise-reminder-log-retention'))
 and end_time<now()-interval '7 days'$job$);
