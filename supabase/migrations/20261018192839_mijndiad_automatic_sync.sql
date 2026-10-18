create extension if not exists http with schema extensions;
-- HTTP is only used by the server-side job, never by browser roles.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_depend d on d.objid=p.oid
    join pg_extension e on e.oid=d.refobjid where e.extname='http' and d.deptype='e' loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',f);
  end loop;
end $$;

create table practice_private.mijndiad_sync (
  practitioner_id uuid primary key references public.practitioners(id),
  feed_secret_id uuid not null references vault.secrets(id),
  enabled boolean not null default false,
  last_attempt_at timestamptz, last_success_at timestamptz,
  last_error text, failure_count integer not null default 0,
  event_count integer not null default 0, changed_count integer not null default 0,
  pending_missing integer not null default 0, coverage_uncertain integer not null default 0
);
alter table practice_private.mijndiad_sync enable row level security;
revoke all on practice_private.mijndiad_sync from public,anon,authenticated,service_role;
alter table public.practice_calendar_events add column external_missing_count integer not null default 0;

create function practice_private.mijndiad_text(v text) returns text language sql immutable
set search_path='' as $$
 select trim(regexp_replace(replace(replace(replace(replace(replace(coalesce(v,''),chr(92)||'n',' '),chr(92)||'N',' '),chr(92)||',',','),chr(92)||';',';'),chr(92)||chr(92),chr(92)), '\s+', ' ', 'g'));
$$;

create function practice_private.mijndiad_instant(p jsonb) returns timestamptz
language plpgsql stable set search_path='' as $$
declare v text:=p->>'value'; z text; t timestamptz; wall text;
begin
  if v is null or v !~ '^[0-9]{8}T[0-9]{6}Z?$' then raise exception 'invalid_calendar'; end if;
  wall:=rtrim(v,'Z');
  if right(v,1)='Z' then z:='UTC';
  else z:=substring(p->>'name' from ';TZID="?([^";]+)'); end if;
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

create function practice_private.parse_mijndiad_calendar(body text, owner_id uuid) returns jsonb
language plpgsql stable set search_path='' as $$
declare s text; block text[]; line text; name text; key text; colon integer;
  fields jsonb; result jsonb:='[]'; seen text[]:='{}'; uid text; h bytea; hex text;
  title text; location text; kind text; color text; link text; status text; a timestamptz; b timestamptz;
begin
  if body is null or octet_length(body)>8000000 then raise exception 'invalid_calendar'; end if;
  s:=trim(regexp_replace(replace(ltrim(body,chr(65279)),E'\r',''),E'\n[ \t]','','g'));
  if s not like E'BEGIN:VCALENDAR\n%' or right(s,13)<>'END:VCALENDAR' then raise exception 'invalid_calendar'; end if;
  for block in select regexp_matches(s,E'BEGIN:VEVENT\n(.*?)END:VEVENT','gs') loop
    fields:='{}';
    foreach line in array string_to_array(trim(block[1],E'\n'),E'\n') loop
      colon:=strpos(line,':');
      if colon<2 then raise exception 'invalid_calendar'; end if;
      name:=left(line,colon-1); key:=split_part(name,';',1);
      if fields ? key or key in ('BEGIN','END','RRULE','RDATE','EXDATE','RECURRENCE-ID','DURATION') then raise exception 'invalid_calendar'; end if;
      fields:=fields||jsonb_build_object(key,jsonb_build_object('name',name,'value',substr(line,colon+1)));
    end loop;
    uid:=fields->'UID'->>'value';
    if uid is null or length(trim(uid))=0 or length(uid)>2048 or uid=any(seen) then raise exception 'invalid_calendar'; end if;
    seen:=array_append(seen,uid);
    a:=practice_private.mijndiad_instant(fields->'DTSTART'); b:=practice_private.mijndiad_instant(fields->'DTEND');
    if b<=a then raise exception 'invalid_calendar'; end if;
    status:=coalesce(fields->'STATUS'->>'value','CONFIRMED');
    if status not in ('CONFIRMED','TENTATIVE','CANCELLED') then raise exception 'invalid_calendar'; end if;
    status:=case when status='CANCELLED' or fields->'TRANSP'->>'value'='TRANSPARENT' then 'cancelled' else 'confirmed' end;
    title:=regexp_replace(practice_private.mijndiad_text(fields->'SUMMARY'->>'value'),'^Bezet\s*[-–—:]\s*','','i');
    if title='' then title:='Afspraak MijnDiAd'; end if;
    location:=practice_private.mijndiad_text(fields->'LOCATION'->>'value');
    if length(title)>100 or length(location)>120 then raise exception 'invalid_calendar'; end if;
    kind:=case when title ~* '^(privé|supervisie|teamvergadering|intervisie|administratie|opleiding)(\s|$)' then 'personal'
      when title ~* '^(verlof|vakantie|pauze|niet beschikbaar)$' then 'block' else 'appointment' end;
    color:=case when kind<>'appointment' then '#687985' when title||' '||location ~* '\monline\M' then '#326b9e' else '#b6506e' end;
    link:=fields->'URL'->>'value';
    if link is null or link !~ '^https://praktijkitransform[.]mijndiad[.]nl/appointments/[0-9]+$' then link:=null; end if;
    h:=extensions.digest('mijndiad:'||owner_id::text||':'||uid,'sha256'); hex:=left(encode(h,'hex'),32);
    hex:=overlay(hex placing '5' from 13 for 1); hex:=overlay(hex placing to_hex(((get_byte(h,8)>>4)&3)|8) from 17 for 1);
    result:=result||jsonb_build_array(jsonb_build_object('id',hex::uuid,'externalUid',encode(extensions.digest(uid,'sha256'),'hex'),
      'startsAt',to_char(a at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'endsAt',to_char(b at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'title',title,'location',location,'kind',kind,'color',color,'status',status,'externalUrl',link));
  end loop;
  if jsonb_array_length(result)=0
    or jsonb_array_length(result)<>(length(s)-length(replace(s,'BEGIN:VEVENT','')))/12
    or jsonb_array_length(result)<>(length(s)-length(replace(s,'END:VEVENT','')))/10 then raise exception 'invalid_calendar'; end if;
  return result;
end;
$$;

-- This operation is private. All data is parsed before writes; exception
-- blocks roll the snapshot back atomically and preserve the previous version.
create function practice_private.apply_mijndiad_snapshot(owner_id uuid, events jsonb) returns jsonb
language plpgsql volatile set search_path='' as $$
declare n integer:=jsonb_array_length(events); previous integer; changed integer; retired integer; pending integer; uncertain integer;
  edge timestamptz;
begin
  if n<1 or n>20000 then raise exception 'invalid_calendar'; end if;
  select event_count into previous from practice_private.mijndiad_sync where practitioner_id=owner_id;
  if previous>0 and n<previous*.7 then raise exception 'suspicious_snapshot'; end if;
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
  select max((x->>'startsAt')::timestamptz) into edge from jsonb_array_elements(events) x;
  -- Missing future records are retired only after TWO complete valid snapshots,
  -- within the observed coverage. Shrinking boundary coverage is flagged.
  update public.practice_calendar_events e set external_missing_count=e.external_missing_count+1,
    status=case when e.external_missing_count>=1 then 'cancelled' else e.status end
  where e.practitioner_id=owner_id and e.external_source='mijndiad' and e.status='confirmed'
    and e.starts_at>now() and e.starts_at<=edge
    and not exists(select 1 from jsonb_array_elements(events) x where x->>'externalUid'=e.external_uid);
  get diagnostics retired=row_count;
  select count(*)::int into pending from public.practice_calendar_events where practitioner_id=owner_id and external_source='mijndiad' and status='confirmed' and external_missing_count>0;
  select count(*)::int into uncertain from public.practice_calendar_events e where practitioner_id=owner_id and external_source='mijndiad'
    and status='confirmed' and starts_at>greatest(now(),edge)
    and not exists(select 1 from jsonb_array_elements(events) x where x->>'externalUid'=e.external_uid);
  perform set_config('mygrowise.mijndiad_import','off',true);
  update practice_private.mijndiad_sync set last_success_at=clock_timestamp(),last_error=null,failure_count=0,event_count=n,
    changed_count=changed,pending_missing=pending,coverage_uncertain=uncertain where practitioner_id=owner_id;
  return jsonb_build_object('ok',true,'events',n,'changed',changed,'missingChecked',retired,'pendingMissing',pending,'coverageUncertain',uncertain);
end;
$$;

create function practice_private.sync_mijndiad_agenda() returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg practice_private.mijndiad_sync; url text; response extensions.http_response; events jsonb; result jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0)) then return jsonb_build_object('skipped',true); end if;
  select c.* into cfg from practice_private.mijndiad_sync c join public.practitioners p on p.id=c.practitioner_id
    where p.slug='virginie' and p.active and c.enabled for update of c;
  if not found then return jsonb_build_object('configured',false); end if;
  if cfg.last_attempt_at>clock_timestamp()-interval '30 seconds' then return jsonb_build_object('skipped',true); end if;
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
    -- Never record SQLERRM: network errors can include the private URL.
    update practice_private.mijndiad_sync set last_error='feed_unavailable_or_invalid',failure_count=failure_count+1 where practitioner_id=cfg.practitioner_id;
    return jsonb_build_object('ok',false,'error','feed_unavailable_or_invalid');
  end;
  return result;
end;
$$;

create function practice_private.mijndiad_sync_status(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',enabled,'lastAttemptAt',last_attempt_at,'lastSuccessAt',last_success_at,
    'lastError',last_error,'failureCount',failure_count,'eventCount',event_count,'pendingMissing',pending_missing,
    'coverageUncertain',coverage_uncertain,'intervalMinutes',5)
  from practice_private.mijndiad_sync where practitioner_id=owner_id;
$$;
create function public.get_mijndiad_sync_status(p_practitioner_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select practice_private.mijndiad_sync_status(p_practitioner_id); $$;
create function public.refresh_mijndiad_agenda() returns jsonb
language sql volatile security invoker set search_path='' as $$ select practice_private.sync_mijndiad_agenda(); $$;

revoke all on function practice_private.mijndiad_text(text),practice_private.mijndiad_instant(jsonb),
  practice_private.parse_mijndiad_calendar(text,uuid),practice_private.apply_mijndiad_snapshot(uuid,jsonb),
  practice_private.sync_mijndiad_agenda(),practice_private.mijndiad_sync_status(uuid),
  public.get_mijndiad_sync_status(uuid),public.refresh_mijndiad_agenda() from public,anon,authenticated,service_role;
grant usage on schema practice_private to service_role;
grant execute on function practice_private.sync_mijndiad_agenda(),practice_private.mijndiad_sync_status(uuid),
  public.get_mijndiad_sync_status(uuid),public.refresh_mijndiad_agenda() to service_role;
-- The vault secret, owner binding and cron schedule are provisioned by the
-- setup script with parameters, never embedded in migration history.
