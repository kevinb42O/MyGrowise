-- The supplied website brief describes sessions of approximately 50 minutes.
-- Update only seeded standard 60-minute values, leaving historic bookings and
-- deliberately different appointment-type/practitioner overrides unchanged.
alter table public.appointment_types alter column duration_minutes set default 50;
alter table public.practitioner_settings drop constraint practitioner_settings_duration;
alter table public.practitioner_settings add constraint practitioner_settings_duration check(appointment_duration_minutes in (45,50,60,75,90));
alter table public.practitioner_settings alter column appointment_duration_minutes set default 50;
update public.appointment_types set duration_minutes=50 where duration_minutes=60 and slug in (
 'intake-psychotherapie-online','psychotherapiesessie-online','intake-emdr-online','emdr-sessie-online',
 'intake-hypnose-online','hypnosesessie-online','intake-hypnose-stoppen-met-roken-online','hypnose-stoppen-met-roken-online',
 'intake-seksuoloog-online','seksuoloog-sessie-online','intake-psycholoog-online','psychologiesessie-online'
);
update public.practitioner_appointment_types o set duration_minutes=50 from public.appointment_types t
 where o.appointment_type_id=t.id and o.duration_minutes=60 and t.duration_minutes=50;
update public.practitioner_settings set appointment_duration_minutes=50 where appointment_duration_minutes=60;
notify pgrst,'reload schema';
