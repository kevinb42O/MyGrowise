-- Daily housekeeping: support content is retained for at most 12 months after
-- the last visible message. Privacy requests are tracked outside this inbox.
select cron.schedule(
  'mygrowise-support-retention',
  '35 3 * * *',
  $job$
    delete from public.support_guest_tokens where expires_at < now() - interval '30 days';
    delete from public.support_guest_sessions where expires_at < now();
    delete from public.support_rate_limits where reset_at < now() - interval '1 day';
    delete from public.support_conversations where last_message_at < now() - interval '12 months';
  $job$
);
