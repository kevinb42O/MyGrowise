-- Makes privileged actions traceable across the Astro request boundary.
-- Existing audit entries remain valid; new fields are intentionally nullable so
-- legacy imports are not rewritten or treated as newly performed actions.

alter table public.security_audit_log
  add column request_id uuid,
  add column request_path text,
  add column before_snapshot jsonb,
  add column after_snapshot jsonb;

alter table public.security_audit_log
  add constraint security_audit_log_request_path_length
    check (char_length(coalesce(request_path, '')) <= 500),
  add constraint security_audit_log_before_snapshot_object
    check (before_snapshot is null or jsonb_typeof(before_snapshot) = 'object'),
  add constraint security_audit_log_after_snapshot_object
    check (after_snapshot is null or jsonb_typeof(after_snapshot) = 'object');

create index security_audit_log_request_time_idx
  on public.security_audit_log (request_id, occurred_at desc)
  where request_id is not null;

create index security_audit_log_object_time_idx
  on public.security_audit_log (object_type, object_id, occurred_at desc);
