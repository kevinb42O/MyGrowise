-- A recent download and a date covered by the download are different
-- conditions. The feed provides no explicit coverage horizon, so use the last
-- observed event end as an upper bound and leave an empty snapshot unverified.
alter table practice_private.mijndiad_sync add column coverage_until timestamptz;
-- Existing snapshots need one new fetch before they can attest coverage.
update practice_private.mijndiad_sync set last_success_at = null, last_attempt_at = null where enabled;

create or replace function practice_private.mijndiad_instant(p jsonb) returns timestamptz
language plpgsql stable set search_path='' as $$
declare v text:=p->>'value'; z text; t timestamptz; wall text;
begin
  if v ~ '^[0-9]{8}$' then
    return make_date(substr(v,1,4)::int,substr(v,5,2)::int,substr(v,7,2)::int)::timestamp at time zone 'Europe/Brussels';
  end if;
  if v is null or v !~ '^[0-9]{8}T[0-9]{6}Z?$' then raise exception 'invalid_calendar'; end if;
  wall:=rtrim(v,'Z');
  if right(v,1)='Z' then z:='UTC';
  else z:=coalesce(substring(p->>'name' from ';TZID="?([^";]+)'), 'Europe/Brussels'); end if;
  if z is null or z not in ('UTC','Europe/Amsterdam','Europe/Brussels') then raise exception 'invalid_calendar'; end if;
  t:=make_timestamptz(substr(wall,1,4)::int,substr(wall,5,2)::int,substr(wall,7,2)::int,
    substr(wall,10,2)::int,substr(wall,12,2)::int,substr(wall,14,2)::int,z);
  if to_char(t at time zone z,'YYYYMMDD"T"HH24MISS')<>wall
    or (z<>'UTC' and (to_char((t-interval '1 hour') at time zone z,'YYYYMMDD"T"HH24MISS')=wall
      or to_char((t+interval '1 hour') at time zone z,'YYYYMMDD"T"HH24MISS')=wall)) then
    raise exception 'invalid_calendar';
  end if;
  return t;
end;
$$;

-- Expand the recurrence forms used for ordinary appointments. Other rule
-- combinations fail closed, so they cannot silently produce free time.
create function practice_private.mijndiad_occurrences(fields jsonb, original_start timestamptz)
returns table(instant timestamptz, explicit_date boolean)
language plpgsql stable set search_path='' as $$
declare
  rule text := fields->'RRULE'->>'value';
  clauses jsonb := '{}';
  part text; key text; value text;
  frequency text;
  stride integer := 1;
  maximum integer;
  cutoff timestamptz;
  zone text := case when right(fields->'DTSTART'->>'value',1)='Z' then 'UTC'
    else coalesce(substring(fields->'DTSTART'->>'name' from ';TZID="?([^";]+)'), 'Europe/Brussels') end;
  anchor timestamp := original_start at time zone zone;
  anchor_day date := anchor::date;
  holiday boolean := (fields->'DTSTART'->>'value') ~ '^[0-9]{8}$';
  day_codes text[] := array['MO','TU','WE','TH','FR','SA','SU'];
  chosen_days text[];
  week_start integer := 1;
  final_day date := greatest(anchor_day, (now() at time zone zone)::date + 366);
  earliest timestamptz := now() - interval '366 days';
  extra_dates timestamptz[] := '{}';
  skipped_dates timestamptz[] := '{}';
begin
  foreach value in array string_to_array(coalesce(fields->'RDATE'->>'value',''), ',') loop
    extra_dates := array_append(extra_dates, practice_private.mijndiad_instant(jsonb_build_object('name',fields->'RDATE'->>'name','value',value)));
  end loop;
  foreach value in array string_to_array(coalesce(fields->'EXDATE'->>'value',''), ',') loop
    skipped_dates := array_append(skipped_dates, practice_private.mijndiad_instant(jsonb_build_object('name',fields->'EXDATE'->>'name','value',value)));
  end loop;
  if rule is not null then
    foreach part in array string_to_array(rule,';') loop
      key := split_part(part,'=',1); value := split_part(part,'=',2);
      if key not in ('FREQ','INTERVAL','COUNT','UNTIL','BYDAY','WKST') or clauses ? key or value='' then
        raise exception 'unsupported_recurrence';
      end if;
      clauses := clauses || jsonb_build_object(key,value);
    end loop;
    frequency := clauses->>'FREQ';
    if frequency is null or frequency not in ('DAILY','WEEKLY','MONTHLY','YEARLY')
      or (clauses ? 'BYDAY' and frequency not in ('DAILY','WEEKLY'))
      or (clauses ? 'COUNT' and clauses ? 'UNTIL') or anchor_day < date '1900-01-01'
      or final_day - anchor_day > 150000 then raise exception 'unsupported_recurrence'; end if;
    if clauses ? 'INTERVAL' then
      if clauses->>'INTERVAL' !~ '^[1-9][0-9]{0,3}$' then raise exception 'unsupported_recurrence'; end if;
      stride := (clauses->>'INTERVAL')::integer;
    end if;
    if clauses ? 'COUNT' then
      if clauses->>'COUNT' !~ '^[1-9][0-9]{0,5}$' then raise exception 'unsupported_recurrence'; end if;
      maximum := (clauses->>'COUNT')::integer;
    end if;
    if clauses ? 'UNTIL' then
      cutoff := practice_private.mijndiad_instant(jsonb_build_object('name','UNTIL;TZID='||zone,'value',clauses->>'UNTIL'));
    end if;
    if clauses ? 'WKST' then
      week_start := array_position(day_codes,clauses->>'WKST');
      if week_start is null then raise exception 'unsupported_recurrence'; end if;
    end if;
    if clauses ? 'BYDAY' then
      chosen_days := string_to_array(clauses->>'BYDAY',',');
      if not chosen_days <@ day_codes then raise exception 'unsupported_recurrence'; end if;
    elsif frequency = 'WEEKLY' then
      chosen_days := array[day_codes[extract(isodow from anchor_day)::integer]];
    end if;
  end if;
  return query
  with dates as (
    select anchor_day + d.step as candidate_day
    from generate_series(0, case when rule is null then 0 else final_day - anchor_day end) d(step)
  ), wall_times as (
    select candidate_day + anchor::time as wall
    from dates where candidate_day = anchor_day or (
      (chosen_days is null or day_codes[extract(isodow from candidate_day)::integer] = any(chosen_days))
      and case frequency
        when 'DAILY' then (candidate_day-anchor_day) % stride = 0
        when 'WEEKLY' then ((candidate_day-anchor_day+(extract(isodow from anchor_day)::integer-week_start+7)%7)/7) % stride = 0
        when 'MONTHLY' then extract(day from candidate_day)=extract(day from anchor_day)
          and ((extract(year from candidate_day)-extract(year from anchor_day))*12+extract(month from candidate_day)-extract(month from anchor_day))::integer % stride=0
        when 'YEARLY' then extract(day from candidate_day)=extract(day from anchor_day) and extract(month from candidate_day)=extract(month from anchor_day)
          and (extract(year from candidate_day)-extract(year from anchor_day))::integer % stride=0
        else false
      end
    )
  ), valid_times as (
    select case when (((wall at time zone zone) - interval '1 hour') at time zone zone) = wall
      then (wall at time zone zone) - interval '1 hour' else wall at time zone zone end as resolved
    from wall_times
    -- RFC recurrence instances in a missing wall hour are omitted from COUNT.
    where ((wall at time zone zone) at time zone zone) = wall
  ), numbered as (
    select case when v.resolved = (anchor at time zone zone) then original_start else v.resolved end as start,
      row_number() over(order by v.resolved) as occurrence
    from valid_times v
  ), combined as (
    select n.start, n.start=original_start or maximum is not null or cutoff is not null as explicit
    from numbered n where (maximum is null or n.occurrence<=maximum) and (cutoff is null or n.start<=cutoff)
    union all select extra, true from unnest(extra_dates) extra
  )
  select c.start, bool_or(c.explicit)
  from combined c
  where c.start <> all(skipped_dates) and (rule is null or c.start >= earliest or c.start=original_start)
  group by c.start order by c.start;
end;
$$;
revoke all on function practice_private.mijndiad_occurrences(jsonb,timestamptz) from public, anon, authenticated;

create or replace function practice_private.parse_mijndiad_calendar(body text, owner_id uuid) returns jsonb
language plpgsql stable set search_path='' as $$
declare s text; block text[]; line text; name text; key text; colon integer;
  matched integer := 0; fields jsonb; result jsonb:='[]'; seen text[]:='{}'; uid text; occurrence_uid text; h bytea; hex text; occurrence record; override_at timestamptz; occurrence_end timestamptz;
  title text; location text; kind text; color text; link text; duration_text text; is_day boolean; status text; a timestamptz; b timestamptz;
begin
  if body is null or octet_length(body)>8000000 then raise exception 'invalid_calendar'; end if;
  s:=trim(regexp_replace(replace(ltrim(body,chr(65279)),E'\r',''),E'\n[ \t]','','g'),E' \n\t');
  if s not like E'BEGIN:VCALENDAR\n%' or right(s,13)<>'END:VCALENDAR' then raise exception 'invalid_calendar'; end if;
  s := regexp_replace(s, E'BEGIN:VALARM\n.*?END:VALARM\n', '', 'gs');
  for block in select regexp_matches(s,E'BEGIN:VEVENT\n(.*?)END:VEVENT','gs') loop
    matched := matched + 1;
    fields:='{}';
    foreach line in array string_to_array(trim(block[1],E'\n'),E'\n') loop
      colon:=strpos(line,':');
      if colon<2 then raise exception 'invalid_calendar'; end if;
      name:=left(line,colon-1); key:=upper(split_part(name,';',1));
      if key in ('BEGIN','END') then raise exception 'invalid_calendar'; end if;
      if key not in ('UID','DTSTART','DTEND','DURATION','STATUS','TRANSP','RECURRENCE-ID','RRULE','RDATE','EXDATE','SUMMARY','LOCATION','URL') then continue; end if;
      if key in ('RDATE','EXDATE') and (fields->key->>'name')=name then
        fields:=jsonb_set(fields,array[key,'value'],to_jsonb((fields->key->>'value')||','||substr(line,colon+1)));
      else
        if fields ? key then raise exception 'invalid_calendar'; end if;
        fields:=fields||jsonb_build_object(key,jsonb_build_object('name',name,'value',substr(line,colon+1)));
      end if;
    end loop;
    uid:=fields->'UID'->>'value';
    if uid is null or length(trim(uid))=0 or length(uid)>2048 then raise exception 'invalid_calendar'; end if;
    status:=coalesce(fields->'STATUS'->>'value','CONFIRMED');
    if status not in ('CONFIRMED','TENTATIVE','CANCELLED') then raise exception 'invalid_calendar'; end if;
    status:=case when status='CANCELLED' or fields->'TRANSP'->>'value'='TRANSPARENT' then 'cancelled' else 'confirmed' end;
    override_at := null;
    if fields ? 'RECURRENCE-ID' then
      if fields->'RECURRENCE-ID'->>'name' like '%;RANGE=%' then raise exception 'unsupported_recurrence'; end if;
      override_at := practice_private.mijndiad_instant(fields->'RECURRENCE-ID');
    end if;
    if (uid || coalesce('#'||to_char(override_at at time zone 'UTC','YYYYMMDD"T"HH24MISS'),''))=any(seen) then raise exception 'invalid_calendar'; end if;
    seen:=array_append(seen,uid || coalesce('#'||to_char(override_at at time zone 'UTC','YYYYMMDD"T"HH24MISS'),''));
    is_day := (coalesce(fields->'DTSTART',fields->'RECURRENCE-ID')->>'value') ~ '^[0-9]{8}$';
    a := practice_private.mijndiad_instant(coalesce(fields->'DTSTART',fields->'RECURRENCE-ID'));
    duration_text := fields->'DURATION'->>'value';
    if fields ? 'DTEND' then
      if duration_text is not null or is_day is distinct from ((fields->'DTEND'->>'value') ~ '^[0-9]{8}$') then raise exception 'invalid_calendar'; end if;
      b := practice_private.mijndiad_instant(fields->'DTEND');
    elsif duration_text is not null then
      if duration_text !~ '^P([0-9]{1,3}W|([0-9]{1,3}D)?(T([0-9]{1,3}H)?([0-9]{1,3}M)?([0-9]{1,3}S)?)?)$'
        or duration_text in ('P','PT') or (is_day and strpos(duration_text,'T')>0) then raise exception 'invalid_duration'; end if;
      b := ((a at time zone 'Europe/Brussels') + make_interval(
        days => 7 * coalesce(substring(duration_text from '([0-9]+)W')::int,0) + coalesce(substring(duration_text from '([0-9]+)D')::int,0)
      )) at time zone 'Europe/Brussels';
      b := b + make_interval(hours => coalesce(substring(duration_text from '([0-9]+)H')::int,0),
        mins => coalesce(substring(duration_text from '([0-9]+)M')::int,0), secs => coalesce(substring(duration_text from '([0-9]+)S')::int,0));
    elsif is_day then
      b := ((a at time zone 'Europe/Brussels') + interval '1 day') at time zone 'Europe/Brussels';
    elsif status = 'cancelled' then
      b := a + interval '1 second';
    else
      raise exception 'invalid_calendar';
    end if;
    if b<=a then raise exception 'invalid_calendar'; end if;
    title:=regexp_replace(practice_private.mijndiad_text(fields->'SUMMARY'->>'value'),'^Bezet\s*[-–—:]\s*','','i');
    if title='' then title:='Afspraak MijnDiAd'; end if;
    location:=practice_private.mijndiad_text(fields->'LOCATION'->>'value');
    title := left(title,100); location := left(location,120);
    kind:=case when title ~* '^(privé|supervisie|teamvergadering|intervisie|administratie|opleiding)(\s|$)' then 'personal'
      when title ~* '^(verlof|vakantie|pauze|niet beschikbaar)$' then 'block' else 'appointment' end;
    color:=case when kind<>'appointment' then '#687985' when title||' '||location ~* '\monline\M' then '#326b9e' else '#b6506e' end;
    link:=fields->'URL'->>'value';
    if link is null or link !~ '^https://praktijkitransform[.]mijndiad[.]nl/appointments/[0-9]+$' then link:=null; end if;
    for occurrence in
      select a as instant, true as explicit_date where override_at is not null or status='cancelled'
      union all select x.instant, x.explicit_date from practice_private.mijndiad_occurrences(fields,a) x
        where override_at is null and status<>'cancelled'
    loop
      occurrence_uid := uid;
      if fields ?| array['RRULE','RDATE','EXDATE','RECURRENCE-ID'] then
        occurrence_uid := uid || '#' || to_char(coalesce(override_at,occurrence.instant) at time zone 'UTC','YYYYMMDD"T"HH24MISS');
      end if;
      occurrence_end := case when is_day then ((occurrence.instant at time zone 'Europe/Brussels') +
        ((b at time zone 'Europe/Brussels') - (a at time zone 'Europe/Brussels'))) at time zone 'Europe/Brussels'
        else occurrence.instant + (b-a) end;
      h:=extensions.digest('mijndiad:'||owner_id::text||':'||occurrence_uid,'sha256'); hex:=left(encode(h,'hex'),32);
      hex:=overlay(hex placing '5' from 13 for 1); hex:=overlay(hex placing to_hex(((get_byte(h,8)>>4)&3)|8) from 17 for 1);
      result:=result||jsonb_build_array(jsonb_build_object('id',hex::uuid,'externalUid',encode(extensions.digest(occurrence_uid,'sha256'),'hex'),
        'startsAt',to_char(occurrence.instant at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'endsAt',to_char(occurrence_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'coverageEdge',occurrence.explicit_date,'override',override_at is not null,
        'title',title,'location',location,'kind',kind,'color',color,'status',status,'externalUrl',link));
      if jsonb_array_length(result)>20000 then raise exception 'invalid_calendar'; end if;
    end loop;
  end loop;
  if matched<>(length(s)-length(replace(s,'BEGIN:VEVENT','')))/12
    or matched<>(length(s)-length(replace(s,'END:VEVENT','')))/10 then raise exception 'invalid_calendar'; end if;
  return coalesce((
    select jsonb_agg(chosen.event) from (
      select distinct on (x->>'externalUid') x as event from jsonb_array_elements(result) x
      order by x->>'externalUid', (x->>'override')::boolean desc
    ) chosen
  ), '[]'::jsonb);
end;
$$;

create or replace function practice_private.apply_mijndiad_snapshot(owner_id uuid, events jsonb) returns jsonb
language plpgsql volatile set search_path='' as $$
declare n integer:=jsonb_array_length(events); changed integer; retired integer; pending integer; uncertain integer;
  edge timestamptz;
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
  select max((x->>'endsAt')::timestamptz) into edge from jsonb_array_elements(events) x
    where coalesce((x->>'coverageEdge')::boolean,true);
  -- Missing future records are retired only after TWO complete valid snapshots,
  -- within the observed coverage. Shrinking boundary coverage is flagged.
  update public.practice_calendar_events e set external_missing_count=e.external_missing_count+1,
    status=case when e.external_missing_count>=1 then 'cancelled' else e.status end
  where e.practitioner_id=owner_id and e.external_source='mijndiad' and e.status='confirmed'
    and e.starts_at>now() and e.ends_at<=edge
    and not exists(select 1 from jsonb_array_elements(events) x where x->>'externalUid'=e.external_uid);
  get diagnostics retired=row_count;
  select count(*)::int into pending from public.practice_calendar_events where practitioner_id=owner_id and external_source='mijndiad' and status='confirmed' and external_missing_count>0;
  select count(*)::int into uncertain from public.practice_calendar_events e where practitioner_id=owner_id and external_source='mijndiad'
    and status='confirmed' and ends_at>coalesce(edge,now()) and ends_at>now()
    and not exists(select 1 from jsonb_array_elements(events) x where x->>'externalUid'=e.external_uid);
  perform set_config('mygrowise.mijndiad_import','off',true);
  update practice_private.mijndiad_sync set last_success_at=clock_timestamp(),last_error=null,failure_count=0,event_count=n,
    changed_count=changed,pending_missing=pending,coverage_uncertain=uncertain,coverage_until=edge where practitioner_id=owner_id;
  return jsonb_build_object('ok',true,'events',n,'changed',changed,'missingChecked',retired,'pendingMissing',pending,'coverageUncertain',uncertain);
end;
$$;

create or replace function practice_private.mijndiad_sync_status(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',enabled,'lastAttemptAt',last_attempt_at,'lastSuccessAt',last_success_at,
    'lastError',last_error,'failureCount',failure_count,'eventCount',event_count,'pendingMissing',pending_missing,
    'coverageUncertain',coverage_uncertain,'coverageUntil',coverage_until,'intervalMinutes',5,'mode','on_demand')
  from practice_private.mijndiad_sync where practitioner_id=owner_id;
$$;

create or replace function practice_private.sync_mijndiad_agenda() returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg practice_private.mijndiad_sync; url text; response extensions.http_response; events jsonb; result jsonb;
  retry_seconds integer;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0)) then return jsonb_build_object('skipped',true,'reason','in_progress'); end if;
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
    update practice_private.mijndiad_sync set last_error=case when sqlerrm='unsupported_recurrence' then 'unsupported_recurrence' else 'feed_unavailable_or_invalid' end,failure_count=failure_count+1 where practitioner_id=cfg.practitioner_id;
    return jsonb_build_object('ok',false,'error','feed_unavailable_or_invalid');
  end;
  return result;
end;
$$;

create function practice_private.mijndiad_covers(p_owner uuid, p_end timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select enabled and coalesce(p_end <= coverage_until, false)
    from practice_private.mijndiad_sync where practitioner_id = p_owner), true);
$$;

create or replace function public.get_offer_slots(p_offer uuid, p_days integer default 30)
returns table(practitioner_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql volatile security invoker set search_path = '' as $$
declare v_owner uuid; v_state jsonb;
begin
  select o.practitioner_id into v_owner from public.practitioner_appointment_types o where o.id = p_offer;
  v_state := practice_private.ensure_mijndiad_fresh(v_owner, 300);
  if v_state->>'usable'='false' or not practice_private.mijndiad_covers(v_owner, now()) then
    raise exception 'external_calendar_unavailable' using errcode='55000';
  end if;
  return query select s.* from practice_private.mijndiad_offer_slots_snapshot(p_offer, p_days) s
    where practice_private.mijndiad_covers(v_owner, s.ends_at);
end;
$$;

create function public.agenda_offer_availability(p_practitioner uuid, p_from timestamptz, p_to timestamptz)
returns table(offer_id uuid, offer_name text, slot_day date, slots jsonb)
language plpgsql volatile security invoker set search_path = '' as $$
declare v_state jsonb; v_days integer;
begin
  if p_from >= p_to or p_to - p_from > interval '62 days' then raise exception 'invalid_range' using errcode='22023'; end if;
  if p_to <= now() then return; end if;
  v_state := practice_private.ensure_mijndiad_fresh(p_practitioner, 300);
  if v_state->>'usable'='false' or not practice_private.mijndiad_covers(p_practitioner, now()) then
    raise exception 'external_calendar_unavailable' using errcode='55000';
  end if;
  v_days := (p_to at time zone 'Europe/Brussels')::date - (now() at time zone 'Europe/Brussels')::date;
  return query
    select o.id, t.name, (s.starts_at at time zone 'Europe/Brussels')::date,
      jsonb_agg(jsonb_build_array(s.starts_at,s.ends_at) order by s.starts_at)
    from public.practitioner_appointment_types o join public.appointment_types t on t.id = o.appointment_type_id
    cross join lateral practice_private.mijndiad_offer_slots_snapshot(o.id, v_days) s
    where o.practitioner_id = p_practitioner and o.active and o.bookable and t.active
      and s.starts_at < p_to and s.ends_at > p_from and practice_private.mijndiad_covers(p_practitioner, s.ends_at)
    group by o.id,t.name,(s.starts_at at time zone 'Europe/Brussels')::date;
end;
$$;

create or replace function practice_private.guard_booking_calendar_freshness()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_state jsonb;
begin
  if new.practitioner_id is null or new.status not in ('pending','confirmed') or new.ends_at <= clock_timestamp() then return new; end if;
  if tg_op='UPDATE' and (new.practitioner_id,new.starts_at,new.ends_at,new.status) is not distinct from
    (old.practitioner_id,old.starts_at,old.ends_at,old.status) then return new; end if;
  v_state := practice_private.ensure_mijndiad_fresh(new.practitioner_id,60);
  if v_state->>'usable'='false' or not practice_private.mijndiad_covers(new.practitioner_id, new.ends_at) then
    raise exception 'external_calendar_unavailable' using errcode='55000';
  end if;
  return new;
end;
$$;

create or replace function public.refresh_mijndiad_agenda() returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare v_owner uuid; v_previous timestamptz; v_result jsonb; v_updated jsonb; v_fetch jsonb;
begin
  select p.id into v_owner from public.practitioners p where p.slug='virginie' and p.active;
  if not found then return jsonb_build_object('outcome', 'inactive', 'configured', false, 'usable', false); end if;
  v_previous := (practice_private.mijndiad_sync_status(v_owner)->>'lastSuccessAt')::timestamptz;
  v_fetch := practice_private.sync_mijndiad_agenda();
  v_updated := practice_private.mijndiad_sync_status(v_owner);
  v_result := jsonb_build_object('sync', v_updated,
    'configured', coalesce((v_updated->>'enabled')::boolean, false),
    'usable', coalesce((v_updated->>'enabled')::boolean and v_updated->>'lastError' is null
      and (v_updated->>'lastSuccessAt')::timestamptz > clock_timestamp() - interval '60 seconds', false));
  return v_result || jsonb_build_object('outcome', case
    when v_fetch->>'configured' = 'false' then 'inactive'
    when (v_updated->>'lastSuccessAt')::timestamptz is distinct from v_previous then 'refreshed'
    when v_fetch->>'reason' = 'in_progress' then 'in_progress'
    when v_updated->>'lastError' is not null then 'failed'
    when v_fetch->>'skipped' = 'true' then 'recent'
    else 'failed'
  end);
end;
$$;

revoke all on function practice_private.mijndiad_covers(uuid,timestamptz),
  public.agenda_offer_availability(uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function practice_private.mijndiad_covers(uuid,timestamptz),
  public.agenda_offer_availability(uuid,timestamptz,timestamptz) to service_role;
alter function public.refresh_mijndiad_agenda() security definer;
revoke all on function public.refresh_mijndiad_agenda() from public, anon, authenticated;
grant execute on function public.refresh_mijndiad_agenda() to service_role;

create or replace function public.get_customer_reschedule_slots(p_customer uuid,p_booking uuid,p_days integer default 90)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_state jsonb;
begin
 select b.practitioner_id into v_owner from public.bookings b
 where b.id=p_booking and b.customer_user_id=p_customer and b.status='confirmed';
 if not found then return; end if;
 if practice_private.confirmed_email(p_customer) is null
 or not exists(select 1 from public.user_roles where user_id=p_customer and role='customer')
 or exists(select 1 from public.user_roles where user_id=p_customer and role<>'customer') then return; end if;
 v_state:=practice_private.ensure_mijndiad_fresh(v_owner,60);
 if v_state->>'usable'='false' or not practice_private.mijndiad_covers(v_owner,now()) then raise exception 'external_calendar_unavailable' using errcode='55000'; end if;
 return query
 with selected as (
   select b.id,b.practitioner_id,b.starts_at original_start,
     (extract(epoch from (b.ends_at-b.starts_at))/60)::integer duration,
     s.minimum_notice_hours,s.booking_horizon_days
   from public.bookings b
   join public.practitioner_appointment_types o on o.id=b.offer_id and o.practitioner_id=b.practitioner_id
   join public.appointment_types t on t.id=o.appointment_type_id
   join public.practitioners p on p.id=b.practitioner_id
   join public.practitioner_settings s on s.practitioner_id=p.id
   where b.id=p_booking and b.customer_user_id=p_customer and b.status='confirmed'
     and b.starts_at>now() and b.starts_at>=now()+make_interval(hours=>s.minimum_notice_hours)
     and o.active and o.bookable and t.active and p.active and s.requests_enabled
 ), candidates as (
   select s.*,
     ((d.day::date+r.start_time) at time zone 'Europe/Brussels')+make_interval(mins=>step.n*15) candidate_start,
     ((d.day::date+r.start_time) at time zone 'Europe/Brussels')+make_interval(mins=>step.n*15+s.duration) candidate_end
   from selected s join public.availability_rules r on r.practitioner_id=s.practitioner_id
   cross join lateral generate_series(timezone('Europe/Brussels',now())::date,
     timezone('Europe/Brussels',now())::date+least(greatest(coalesce(p_days,90),1),s.booking_horizon_days),interval '1 day') d(day)
   cross join lateral generate_series(0,floor((extract(epoch from (r.end_time-r.start_time))/60-s.duration)/15)::integer) step(n)
   where extract(isodow from d.day)=r.weekday
 ) select distinct c.candidate_start,c.candidate_end from candidates c
 where c.candidate_start<>c.original_start
   and practice_private.mijndiad_covers(v_owner,c.candidate_end)
   and c.candidate_start>=now()+make_interval(hours=>c.minimum_notice_hours)
   and not exists(select 1 from public.bookings b where b.practitioner_id=c.practitioner_id and b.id<>c.id
     and b.status in ('pending','confirmed') and b.time_range&&tstzrange(c.candidate_start,c.candidate_end,'[)'))
   and not exists(select 1 from public.availability_exceptions e where e.practitioner_id=c.practitioner_id and e.kind='unavailable'
     and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.candidate_start,c.candidate_end,'[)'))
   and not exists(select 1 from public.practice_calendar_events e where e.practitioner_id=c.practitioner_id and e.status='confirmed'
     and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.candidate_start,c.candidate_end,'[)'))
 order by c.candidate_start;
end; $$;


create or replace function public.get_bookable_slots(p_practitioner_slug text,p_days integer default 14)
returns table(practitioner_id uuid,starts_at timestamptz,ends_at timestamptz)
language plpgsql volatile security invoker set search_path='' as $$
declare v_owner uuid; v_state jsonb;
begin
  select p.id into v_owner from public.practitioners p where p.slug=lower(trim(p_practitioner_slug));
  v_state:=practice_private.ensure_mijndiad_fresh(v_owner,300);
  if v_state->>'usable'='false' or not practice_private.mijndiad_covers(v_owner,now()) then
    raise exception 'external_calendar_unavailable' using errcode='55000';
  end if;
  return query select s.* from practice_private.mijndiad_bookable_slots_snapshot(p_practitioner_slug,p_days) s
    where practice_private.mijndiad_covers(v_owner,s.ends_at);
end;
$$;
