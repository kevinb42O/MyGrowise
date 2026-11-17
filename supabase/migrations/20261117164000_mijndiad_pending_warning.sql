-- A missing event that has already ended cannot block future bookings.
-- Compute this warning at read time so it expires even between feed refreshes.
create or replace function practice_private.mijndiad_sync_status(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',s.enabled,'lastAttemptAt',s.last_attempt_at,'lastSuccessAt',s.last_success_at,
    'lastError',s.last_error,'failureCount',s.failure_count,'eventCount',s.event_count,
    'pendingMissing',(select count(*) from public.practice_calendar_events e
      where e.practitioner_id=s.practitioner_id and e.external_source='mijndiad'
        and e.status='confirmed' and e.external_missing_count>0 and e.ends_at>now()),
    'coverageUncertain',s.coverage_uncertain,'coverageFrom',s.coverage_from,'coverageUntil',s.coverage_until,
    'intervalMinutes',5,'mode','on_demand')
  from practice_private.mijndiad_sync s where s.practitioner_id=owner_id;
$$;
