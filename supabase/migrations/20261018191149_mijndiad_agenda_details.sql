alter table public.practice_calendar_events
  add column external_url text,
  add constraint practice_calendar_external_url check (
    external_url is null or (external_source is not null and external_source = 'mijndiad'
      and external_url ~ '^https://praktijkitransform[.]mijndiad[.]nl/appointments/[0-9]+$')
  );
