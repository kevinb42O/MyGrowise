-- Read-only operational projection. Never expose message content, recipients,
-- payloads, lease tokens or arbitrary provider errors through the admin view.
create view public.admin_mail_overview with (security_invoker = true) as
with jobs as (
 select 'support_mail_jobs'::text as queue,id,kind,status,attempts,created_at,sent_at,next_attempt_at,lease_until,last_error,null::text as delivery_outcome
 from public.support_mail_jobs
 union all
 select 'commerce_mail_jobs',id,event,status,attempts,created_at,sent_at,next_attempt_at,lease_until,last_error,null::text
 from public.commerce_mail_jobs
 union all
 select 'booking_mail_jobs',id,kind,status,attempts,created_at,sent_at,next_attempt_at,lease_until,last_error,null::text
 from public.booking_mail_jobs
 union all
 select 'website_mail_jobs',id,kind,status,attempts,created_at,sent_at,next_attempt_at,lease_until,null::text,delivery_outcome
 from public.website_mail_jobs
)
select queue,id,kind,status,attempts,created_at,sent_at,next_attempt_at,lease_until,
 case when status <> 'sent' then status
      when sent_at is null then 'unconfirmed'
      when queue = 'commerce_mail_jobs' and last_error = 'delivery_access_inactive' then 'unconfirmed'
      when queue = 'website_mail_jobs' and delivery_outcome is distinct from 'sent' then 'unconfirmed'
      else 'sent' end as display_status,
 case when status = 'sent' then
   case when (queue = 'commerce_mail_jobs' and last_error = 'delivery_access_inactive')
          or (queue = 'website_mail_jobs' and delivery_outcome = 'skipped') then 'skipped'
        when sent_at is null or (queue = 'website_mail_jobs' and delivery_outcome is distinct from 'sent') then 'unconfirmed'
        else 'sent' end
   else null end as completion_outcome,
 case when last_error in ('lease_expired','delivery_failed','delivery_access_inactive','smtp_not_configured','mail_not_configured') then last_error
      when last_error is not null then 'unknown_error'
      else null end as diagnosis_code
from jobs;

revoke all on public.admin_mail_overview from public,anon,authenticated;
grant select on public.admin_mail_overview to service_role;

create function public.admin_mail_counts()
returns table(queue text,status text,total bigint)
language sql stable security invoker set search_path = '' as $$
 select m.queue,m.display_status,count(*)
 from public.admin_mail_overview m
 where m.display_status in ('pending','sending','failed','sent','unconfirmed')
 group by m.queue,m.display_status;
$$;
revoke all on function public.admin_mail_counts() from public,anon,authenticated;
grant execute on function public.admin_mail_counts() to service_role;
