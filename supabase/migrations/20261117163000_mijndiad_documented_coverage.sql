-- MijnDiAd's published iCal contract covers one month back through twelve
-- months ahead. The latest event is not the end of the covered period.
-- Source (verified 2026-11-17):
-- https://mijndiad.nl/kennisbank/hoe-kan-ik-de-mijndiad-praktijkagenda-tonen-in-mijn-prive-agenda-google-icloud-outlook/
-- Only a successful, validated snapshot can advance the window.
alter table practice_private.mijndiad_sync add column coverage_from timestamptz;

create or replace function practice_private.apply_mijndiad_snapshot(owner_id uuid, events jsonb) returns jsonb
language plpgsql volatile set search_path='' as $$
declare n integer:=jsonb_array_length(events); changed integer; retired integer; pending integer; uncertain integer;
  edge timestamptz; window_start timestamptz;
begin
  if n>20000 then raise exception 'invalid_calendar'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  perform set_config('mygrowise.mijndiad_import','on',true);
  insert into public.practice_calendar_events(id,practitioner_id,calendar_scope,title,starts_at,ends_at,status,event_kind,location,color,external_source,external_uid,external_url,external_missing_count)
  select (x->>'id')::uuid,owner_id,'itransform',x->>'title',(x->>'startsAt')::timestamptz,(x->>'endsAt')::timestamptz,x->>'status',x->>'kind',x->>'location',x->>'color','mijndiad',x->>'externalUid',x->>'externalUrl',0
  from jsonb_array_elements(events) x
  on conflict(practitioner_id,external_source,external_uid) where external_source is not null do update
    set title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,
      event_kind=excluded.event_kind,location=excluded.location,color=excluded.color,external_url=excluded.external_url,external_missing_count=0
    where (practice_calendar_events.title,practice_calendar_events.starts_at,practice_calendar_events.ends_at,practice_calendar_events.status,
      practice_calendar_events.event_kind,practice_calendar_events.location,practice_calendar_events.color,practice_calendar_events.external_url,practice_calendar_events.external_missing_count)
      is distinct from (excluded.title,excluded.starts_at,excluded.ends_at,excluded.status,excluded.event_kind,excluded.location,excluded.color,excluded.external_url,0);
  get diagnostics changed=row_count;
  -- The provider documents a rolling month back / twelve months ahead.
  -- Use complete local days, avoiding assumptions about partial boundary days.
  window_start := ((clock_timestamp() at time zone 'Europe/Brussels')::date - interval '1 month' + interval '1 day') at time zone 'Europe/Brussels';
  edge := ((clock_timestamp() at time zone 'Europe/Brussels')::date + interval '12 months') at time zone 'Europe/Brussels';
  -- Two successful snapshots must omit an event before it is retired.
  -- An empty, valid calendar still attests to this documented coverage window.
  update public.practice_calendar_events e set external_missing_count=e.external_missing_count+1,
    status=case when e.external_missing_count>=1 then 'cancelled' else e.status end
  where e.practitioner_id=owner_id and e.external_source='mijndiad' and e.status='confirmed'
    and e.starts_at>now() and e.starts_at>=window_start and e.ends_at<=edge
    and not exists(select 1 from jsonb_array_elements(events) x where x->>'externalUid'=e.external_uid);
  get diagnostics retired=row_count;
  select count(*)::int into pending from public.practice_calendar_events where practitioner_id=owner_id and external_source='mijndiad' and status='confirmed' and external_missing_count>0;
  select count(*)::int into uncertain from public.practice_calendar_events e where practitioner_id=owner_id and external_source='mijndiad'
    and status='confirmed' and ends_at>coalesce(edge,now()) and ends_at>now()
    and not exists(select 1 from jsonb_array_elements(events) x where x->>'externalUid'=e.external_uid);
  perform set_config('mygrowise.mijndiad_import','off',true);
  update practice_private.mijndiad_sync set last_success_at=clock_timestamp(),last_error=null,failure_count=0,event_count=n,
    changed_count=changed,pending_missing=pending,coverage_uncertain=uncertain,coverage_from=window_start,coverage_until=edge where practitioner_id=owner_id;
  return jsonb_build_object('ok',true,'events',n,'changed',changed,'missingChecked',retired,'pendingMissing',pending,'coverageUncertain',uncertain);
end;
$$;

create or replace function practice_private.mijndiad_sync_status(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',enabled,'lastAttemptAt',last_attempt_at,'lastSuccessAt',last_success_at,
    'lastError',last_error,'failureCount',failure_count,'eventCount',event_count,'pendingMissing',pending_missing,
    'coverageUncertain',coverage_uncertain,'coverageFrom',coverage_from,'coverageUntil',coverage_until,'intervalMinutes',5,'mode','on_demand')
  from practice_private.mijndiad_sync where practitioner_id=owner_id;
$$;

