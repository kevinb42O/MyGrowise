-- Installed explicitly after deployment by configure-booking-reminders.mjs.
-- Only invokes the mail endpoint when there is actual due work; no keepalive.
create or replace function public.dispatch_due_booking_reminders() returns void
language plpgsql security definer set search_path='' as $$
declare endpoint text; token text;
begin
 if not exists(select 1 from public.booking_mail_jobs where kind='reminder'
   and ((status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now()))
   and scheduled_for<=now() and scheduled_for>now()-interval '15 minutes') then return; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='booking_reminder_endpoint';
 select decrypted_secret into token from vault.decrypted_secrets where name='booking_reminder_token';
 if endpoint is null or token is null then raise exception 'reminder_dispatch_not_configured'; end if;
 perform net.http_get(url:=endpoint,headers:=jsonb_build_object('Authorization','Bearer '||token),timeout_milliseconds:=55000);
end; $$;
revoke all on function public.dispatch_due_booking_reminders() from public,anon,authenticated,service_role;
