-- Demand-driven only: active practice browsing uses a one-minute cache.
-- Pending disappearances also shorten otherwise five-minute availability reads.
-- Preserve the shared lock, minimum fetch interval, outage backoff and two snapshots.
create or replace function practice_private.ensure_mijndiad_fresh(owner_id uuid, max_age_seconds integer default 300) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg practice_private.mijndiad_sync; age_seconds integer:=least(300,greatest(60,coalesce(max_age_seconds,300))); usable boolean;
begin
  select * into cfg from practice_private.mijndiad_sync where practitioner_id=owner_id;
  if not found then return jsonb_build_object('configured',false,'usable',true,'sync',null); end if;
  if exists(select 1 from public.practice_calendar_events e where e.practitioner_id=owner_id
    and e.external_source='mijndiad' and e.status='confirmed' and e.external_missing_count>0 and e.ends_at>now()) then age_seconds:=60; end if;
  usable:=cfg.enabled and cfg.last_error is null and coalesce(cfg.last_success_at>clock_timestamp()-make_interval(secs=>age_seconds),false);
  if not usable and cfg.enabled then
    if pg_try_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0)) then
      select * into cfg from practice_private.mijndiad_sync where practitioner_id=owner_id;
      if exists(select 1 from public.practice_calendar_events e where e.practitioner_id=owner_id
    and e.external_source='mijndiad' and e.status='confirmed' and e.external_missing_count>0 and e.ends_at>now()) then age_seconds:=60; end if;
      if cfg.last_error is not null or cfg.last_success_at is null or cfg.last_success_at<=clock_timestamp()-make_interval(secs=>age_seconds) then
        perform practice_private.sync_mijndiad_agenda();
      end if;
    end if;
    select * into cfg from practice_private.mijndiad_sync where practitioner_id=owner_id;
    usable:=cfg.enabled and cfg.last_error is null and coalesce(cfg.last_success_at>clock_timestamp()-make_interval(secs=>age_seconds),false);
  end if;
  return jsonb_build_object('configured',true,'usable',usable,'sync',practice_private.mijndiad_sync_status(owner_id));
end;
$$;

create or replace function practice_private.mijndiad_sync_status(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',enabled,'lastAttemptAt',last_attempt_at,'lastSuccessAt',last_success_at,
    'lastError',last_error,'failureCount',failure_count,'eventCount',event_count,
    'pendingMissing',(select count(*) from public.practice_calendar_events e where e.practitioner_id=state.practitioner_id
      and e.external_source='mijndiad' and e.status='confirmed' and e.external_missing_count>0 and e.ends_at>now()),
    'coverageUncertain',coverage_uncertain,'coverageFrom',coverage_from,'coverageUntil',coverage_until,'intervalMinutes',1,'mode','on_demand',
    'nextCheckAt',case when enabled then next_check end,
    'retryAfterSeconds',case when enabled then greatest(0,ceil(extract(epoch from (next_check-clock_timestamp()))))::integer end)
  from (
    select s.*,case when last_error is not null then
      coalesce(last_attempt_at,clock_timestamp()) + make_interval(secs=>least(900,60*(2^least(greatest(failure_count-1,0),4)))::integer)
    else greatest(coalesce(last_success_at,clock_timestamp())+interval '60 seconds',
      coalesce(last_attempt_at,last_success_at,clock_timestamp())+interval '60 seconds') end as next_check
    from practice_private.mijndiad_sync s where practitioner_id=owner_id
  ) state;
$$;
-- CREATE OR REPLACE preserves the existing, service_role-only grants.
