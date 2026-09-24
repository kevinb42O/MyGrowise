-- Retain the original local booking identifier during the one-time SQLite to
-- Supabase cutover. This makes the importer safe to rerun without creating
-- duplicate bookings, while keeping the legacy reference out of public APIs.
alter table public.bookings
  add column legacy_source_id text unique;

alter table public.bookings
  add constraint bookings_legacy_source_id_length
  check (legacy_source_id is null or char_length(legacy_source_id) between 1 and 128);
