-- Keep terminal queue states compatible with existing workers, but distinguish
-- SMTP transmission from deliberately completing a task without sending mail.
alter table public.website_mail_jobs add column delivery_outcome text
  check (delivery_outcome in ('sent','skipped'));

-- Contact tasks always call the transport before marking the job sent.
-- Historical purchase_access tasks cannot be classified from today's buyers.
update public.website_mail_jobs set delivery_outcome = 'sent'
where status = 'sent' and sent_at is not null and kind = 'contact';
