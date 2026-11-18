-- Preserve the actual destination of future successful transmissions.
-- Older jobs are resolved from their original job or related record, without
-- rewriting history as if a transport snapshot had existed.
alter table public.support_mail_jobs add column recipient_email_snapshot text, add column recipient_name_snapshot text, add column client_name_snapshot text;
alter table public.commerce_mail_jobs add column recipient_email_snapshot text, add column recipient_name_snapshot text, add column client_name_snapshot text;
alter table public.website_mail_jobs add column recipient_email_snapshot text, add column recipient_name_snapshot text, add column client_name_snapshot text;

-- Auth identities are not directly readable by service_role in this database.
-- Expose only the identity belonging to a support conversation, never auth rows.
create function public.admin_support_mail_identity(p_conversation_id uuid)
returns table(email text,name text)
language sql stable security definer set search_path = '' rows 1 as $$
 select coalesce(c.guest_email,u.email),
        coalesce(nullif(c.guest_name,''),nullif(p.full_name,''),nullif(u.raw_user_meta_data->>'full_name',''))
 from public.support_conversations c
 left join auth.users u on u.id=c.customer_user_id
 left join public.profiles p on p.id=c.customer_user_id
 where c.id=p_conversation_id;
$$;
revoke all on function public.admin_support_mail_identity(uuid) from public,anon,authenticated;
grant execute on function public.admin_support_mail_identity(uuid) to service_role;

-- Recipient identity is operational information for the authorized admin.
-- Only explicit identity fields are projected; message bodies and tokens stay private.
create or replace view public.admin_mail_overview with (security_invoker = true) as
with jobs as (
 select 'support_mail_jobs'::text as queue,j.id,j.kind,j.status,j.attempts,j.created_at,j.sent_at,j.next_attempt_at,j.lease_until,j.last_error,null::text as delivery_outcome,
   coalesce(j.recipient_email_snapshot,c.email) as recipient_email,
   case when j.recipient_email_snapshot is not null then j.recipient_name_snapshot
        else c.name end as recipient_name,
   case when j.recipient_email_snapshot is not null then j.client_name_snapshot
        else c.name end as client_name,
   case when j.recipient_email_snapshot is not null then 'snapshot' else 'current' end as recipient_source
 from public.support_mail_jobs j
 left join lateral public.admin_support_mail_identity(j.conversation_id) c on true
 union all
 select 'commerce_mail_jobs',j.id,j.event,j.status,j.attempts,j.created_at,j.sent_at,j.next_attempt_at,j.lease_until,j.last_error,null::text,
   coalesce(j.recipient_email_snapshot,case when j.target='team' then 'info@mygrowise.be' else coalesce(nullif(o.contact_snapshot->>'email',''),b.email) end),
   case when j.recipient_email_snapshot is not null then j.recipient_name_snapshot
        when j.target='team' then 'MyGrowise-team'
        else nullif(trim(concat_ws(' ',coalesce(nullif(o.contact_snapshot->>'first_name',''),b.first_name),coalesce(nullif(o.contact_snapshot->>'last_name',''),b.last_name))),'') end,
   case when j.recipient_email_snapshot is not null then j.client_name_snapshot
        else nullif(trim(concat_ws(' ',coalesce(nullif(o.contact_snapshot->>'first_name',''),b.first_name),coalesce(nullif(o.contact_snapshot->>'last_name',''),b.last_name))),'') end,
   case when j.recipient_email_snapshot is not null then 'snapshot' else 'order' end
 from public.commerce_mail_jobs j
 left join public.orders o on o.id=j.order_id
 left join public.commerce_buyers b on b.id=o.buyer_id
 union all
 select 'booking_mail_jobs',j.id,j.kind,j.status,j.attempts,j.created_at,j.sent_at,j.next_attempt_at,j.lease_until,j.last_error,null::text,
   j.recipient,nullif(j.payload->>'name',''),nullif(j.payload->>'name',''),'job'
 from public.booking_mail_jobs j
 union all
 select 'website_mail_jobs',j.id,j.kind,j.status,j.attempts,j.created_at,j.sent_at,j.next_attempt_at,j.lease_until,null::text,j.delivery_outcome,
   coalesce(j.recipient_email_snapshot,case when j.kind='contact' then 'info@mygrowise.be' else nullif(j.payload->>'email','') end),
   case when j.recipient_email_snapshot is not null then j.recipient_name_snapshot
        when j.kind='contact' then 'MyGrowise-team'
        else nullif(trim(concat_ws(' ',coalesce(nullif(o.contact_snapshot->>'first_name',''),b.first_name),coalesce(nullif(o.contact_snapshot->>'last_name',''),b.last_name))),'') end,
   case when j.recipient_email_snapshot is not null then j.client_name_snapshot
        when j.kind='contact' then nullif(j.payload->>'name','')
        else nullif(trim(concat_ws(' ',coalesce(nullif(o.contact_snapshot->>'first_name',''),b.first_name),coalesce(nullif(o.contact_snapshot->>'last_name',''),b.last_name))),'') end,
   case when j.recipient_email_snapshot is not null then 'snapshot' else 'job' end
 from public.website_mail_jobs j
 left join lateral (
   select ord.contact_snapshot from public.orders ord
   where ord.contact_snapshot->>'email'=j.payload->>'email' order by ord.created_at desc,ord.id limit 1
 ) o on j.kind<>'contact'
 left join lateral (
   select buyer.first_name,buyer.last_name from public.commerce_buyers buyer
   where buyer.email=j.payload->>'email' order by buyer.created_at desc,buyer.id limit 1
 ) b on j.kind<>'contact'
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
      else null end as diagnosis_code,
 recipient_email,recipient_name,client_name,recipient_source
from jobs;

revoke all on public.admin_mail_overview from public,anon,authenticated;
grant select on public.admin_mail_overview to service_role;
