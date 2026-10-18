-- Supabase Free: shared freshness cache; no recurring network work.
create or replace function practice_private.mijndiad_sync_status(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',enabled,'lastAttemptAt',last_attempt_at,'lastSuccessAt',last_success_at,
    'lastError',last_error,'failureCount',failure_count,'eventCount',event_count,'pendingMissing',pending_missing,
    'coverageUncertain',coverage_uncertain,'intervalMinutes',5,'mode','on_demand')
  from practice_private.mijndiad_sync where practitioner_id=owner_id;
$$;

-- Even manual refresh respects a shared minimum interval and outage backoff.
create or replace function practice_private.sync_mijndiad_agenda() returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg practice_private.mijndiad_sync; url text; response extensions.http_response; events jsonb; result jsonb;
  retry_seconds integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0)) then return jsonb_build_object('skipped',true); end if;
  select c.* into cfg from practice_private.mijndiad_sync c join public.practitioners p on p.id=c.practitioner_id
    where p.slug='virginie' and p.active and c.enabled for update of c;
  if not found then return jsonb_build_object('configured',false); end if;
  retry_seconds:=case when cfg.last_error is null then 60 else least(900,60*(2^least(greatest(cfg.failure_count-1,0),4)))::integer end;
  if cfg.last_attempt_at>clock_timestamp()-make_interval(secs=>retry_seconds) then return jsonb_build_object('skipped',true); end if;
  update practice_private.mijndiad_sync set last_attempt_at=clock_timestamp() where practitioner_id=cfg.practitioner_id;
  begin
    select decrypted_secret into url from vault.decrypted_secrets where id=cfg.feed_secret_id;
    if url is null or url !~ '^https://praktijkitransform[.]mijndiad[.]nl/public/ical/[a-f0-9]+[.]ics$' then raise exception 'invalid_feed_url'; end if;
    perform set_config('http.curlopt_timeout_msec','8000',true);
    perform set_config('http.curlopt_connecttimeout_msec','3000',true);
    perform set_config('http.curlopt_followlocation','0',true);
    select * into response from extensions.http_get(url);
    if response.status<>200 or response.content_type not like 'text/calendar%' then raise exception 'feed_unavailable'; end if;
    events:=practice_private.parse_mijndiad_calendar(response.content,cfg.practitioner_id);
    result:=practice_private.apply_mijndiad_snapshot(cfg.practitioner_id,events);
  exception when others then
    update practice_private.mijndiad_sync set last_error='feed_unavailable_or_invalid',failure_count=failure_count+1 where practitioner_id=cfg.practitioner_id;
    return jsonb_build_object('ok',false,'error','feed_unavailable_or_invalid');
  end;
  return result;
end;
$$;

-- Only the server can call this. The feed address never leaves Vault.
create function practice_private.ensure_mijndiad_fresh(owner_id uuid, max_age_seconds integer default 300) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg practice_private.mijndiad_sync; age_seconds integer:=least(300,greatest(60,coalesce(max_age_seconds,300))); usable boolean;
begin
  select * into cfg from practice_private.mijndiad_sync where practitioner_id=owner_id;
  if not found then return jsonb_build_object('configured',false,'usable',true,'sync',null); end if;
  usable:=cfg.enabled and cfg.last_error is null and coalesce(cfg.last_success_at>clock_timestamp()-make_interval(secs=>age_seconds),false);
  if not usable and cfg.enabled then
    -- Never wait for the global import lock while a booking may already own
    -- its practitioner lock. A concurrent refresh fails closed instead.
    if pg_try_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0)) then
      -- Recheck after acquiring the lock, so concurrent visitors share one fetch.
      select * into cfg from practice_private.mijndiad_sync where practitioner_id=owner_id;
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
create function public.ensure_mijndiad_fresh(p_practitioner_id uuid,p_max_age_seconds integer default 300) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select practice_private.ensure_mijndiad_fresh(p_practitioner_id,p_max_age_seconds);
$$;
create or replace function public.refresh_mijndiad_agenda() returns jsonb
language sql volatile security invoker set search_path='' as $$
 select practice_private.ensure_mijndiad_fresh(p.id,60) from public.practitioners p where p.slug='virginie' and p.active;
$$;
revoke all on function practice_private.ensure_mijndiad_fresh(uuid,integer),public.ensure_mijndiad_fresh(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function practice_private.ensure_mijndiad_fresh(uuid,integer),public.ensure_mijndiad_fresh(uuid,integer) to service_role;

-- Preserve the proven slot calculation privately. Public RPC identities and
-- signatures stay compatible with existing deployed booking pages.
do $$ declare definition text; begin
  definition:=pg_get_functiondef('public.get_offer_slots(uuid,integer)'::regprocedure);
  execute replace(definition,'FUNCTION public.get_offer_slots(', 'FUNCTION practice_private.mijndiad_offer_slots_snapshot(');
  definition:=pg_get_functiondef('public.get_bookable_slots(text,integer)'::regprocedure);
  execute replace(definition,'FUNCTION public.get_bookable_slots(', 'FUNCTION practice_private.mijndiad_bookable_slots_snapshot(');
end $$;
revoke all on function practice_private.mijndiad_offer_slots_snapshot(uuid,integer),practice_private.mijndiad_bookable_slots_snapshot(text,integer) from public,anon,authenticated,service_role;
grant execute on function practice_private.mijndiad_offer_slots_snapshot(uuid,integer),practice_private.mijndiad_bookable_slots_snapshot(text,integer) to service_role;

create or replace function public.get_offer_slots(p_offer uuid,p_days integer default 30)
returns table(practitioner_id uuid,starts_at timestamptz,ends_at timestamptz)
language plpgsql volatile security invoker set search_path='' as $$
declare owner_id uuid; state jsonb;
begin
  select o.practitioner_id into owner_id from public.practitioner_appointment_types o where o.id=p_offer;
  state:=practice_private.ensure_mijndiad_fresh(owner_id,300);
  if state->>'usable'='false' then raise exception 'external_calendar_unavailable' using errcode='55000'; end if;
  return query select * from practice_private.mijndiad_offer_slots_snapshot(p_offer,p_days);
end;
$$;
create or replace function public.get_bookable_slots(p_practitioner_slug text,p_days integer default 14)
returns table(practitioner_id uuid,starts_at timestamptz,ends_at timestamptz)
language plpgsql volatile security invoker set search_path='' as $$
declare owner_id uuid; state jsonb;
begin
  select p.id into owner_id from public.practitioners p where p.slug=lower(trim(p_practitioner_slug));
  state:=practice_private.ensure_mijndiad_fresh(owner_id,300);
  if state->>'usable'='false' then raise exception 'external_calendar_unavailable' using errcode='55000'; end if;
  return query select * from practice_private.mijndiad_bookable_slots_snapshot(p_practitioner_slug,p_days);
end;
$$;
revoke all on function public.get_offer_slots(uuid,integer),public.get_bookable_slots(text,integer) from public,anon,authenticated;
grant execute on function public.get_offer_slots(uuid,integer),public.get_bookable_slots(text,integer) to service_role;

-- Covers every booking writer, including older RPCs and direct server writes.
-- The web service preflights separately so upstream failure/backoff metadata
-- survives even when the booking transaction is rejected.
create function practice_private.guard_booking_calendar_freshness() returns trigger
language plpgsql security definer set search_path='' as $$
declare state jsonb;
begin
  if new.practitioner_id is null or new.status not in ('pending','confirmed') or new.ends_at<=clock_timestamp() then return new; end if;
  if tg_op='UPDATE' then
    if (new.practitioner_id,new.starts_at,new.ends_at,new.status) is not distinct from
      (old.practitioner_id,old.starts_at,old.ends_at,old.status) then return new; end if;
  end if;
  state:=practice_private.ensure_mijndiad_fresh(new.practitioner_id,60);
  if state->>'usable'='false' then raise exception 'external_calendar_unavailable' using errcode='55000'; end if;
  return new;
end;
$$;
revoke all on function practice_private.guard_booking_calendar_freshness() from public,anon,authenticated,service_role;
create trigger bookings_00_calendar_freshness before insert or update of practitioner_id,starts_at,ends_at,status on public.bookings
for each row execute function practice_private.guard_booking_calendar_freshness();

-- Deactivate rather than delete the old job; no new scheduler/keepalive job.
do $$ declare job_id bigint; begin
  for job_id in select jobid from cron.job where jobname='mygrowise-mijndiad-sync' loop
    perform cron.alter_job(job_id,active:=false);
  end loop;
end $$;
