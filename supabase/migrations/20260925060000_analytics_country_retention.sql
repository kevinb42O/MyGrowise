alter table public.analytics_events
  add column country_code text
  constraint analytics_events_country_code check (country_code is null or country_code ~ '^[A-Z]{2}$');

-- Keep the complete 12-month report available while limiting event retention.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'mygrowise-analytics-retention',
  '20 3 * * *',
  $$delete from public.analytics_events where occurred_at < now() - interval '13 months'$$
);
