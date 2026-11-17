-- Calendar detail reads go through scoped server routes. Admin can still see
-- anonymous occupancy for any professional in the organization calendar.
alter policy "practice calendar events: admin read" on public.practice_calendar_events
  using (public.is_admin() and calendar_scope = 'mygrowise' and external_source is null);
alter policy "availability exceptions: staff read own" on public.availability_exceptions
  using (public.owns_practitioner(practitioner_id));

-- Preserve the audit events while removing private content written by older
-- practice editors.
update public.security_audit_log set
  before_snapshot = case when before_snapshot->>'calendar_scope'='itransform' then before_snapshot - array['title','location','color'] else before_snapshot end,
  after_snapshot = case when after_snapshot->>'calendar_scope'='itransform' then after_snapshot - array['title','location','color'] else after_snapshot end
where object_type='practice_calendar_event' and
  (before_snapshot->>'calendar_scope'='itransform' or after_snapshot->>'calendar_scope'='itransform');

create function public.agenda_private_occupancy(p_from timestamptz, p_to timestamptz, p_practitioner uuid)
returns table(id uuid, practitioner_id uuid, practitioner_name text, starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select md5('exception:' || e.id)::uuid, e.practitioner_id, p.name, e.starts_at, e.ends_at
  from public.availability_exceptions e join public.practitioners p on p.id = e.practitioner_id
  where e.kind = 'unavailable' and e.starts_at < p_to and e.ends_at > p_from
    and (p_practitioner is null or e.practitioner_id = p_practitioner)
  union all
  select md5('event:' || e.id)::uuid, e.practitioner_id, p.name, e.starts_at, e.ends_at
  from public.practice_calendar_events e join public.practitioners p on p.id = e.practitioner_id
  where e.calendar_scope = 'itransform' and e.status = 'confirmed' and e.starts_at < p_to and e.ends_at > p_from
    and (p_practitioner is null or e.practitioner_id = p_practitioner);
$$;

create function public.mutate_agenda_item(
  p_actor uuid, p_mode text, p_operation text, p_practitioner uuid, p_id uuid,
  p_revision timestamptz, p_values jsonb, p_request uuid, p_path text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_owner public.practitioners%rowtype;
  v_event public.practice_calendar_events%rowtype;
  v_block public.availability_exceptions%rowtype;
  v_scope text := p_values->>'calendar_scope';
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
  v_type text;
  v_action text;
begin
  if p_mode = 'admin' then
    if not exists (select 1 from public.user_roles where user_id = p_actor and role = 'super_admin') then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  elsif p_mode = 'practice' then
    select * into v_owner from public.practitioners where id = p_practitioner and user_id = p_actor;
    if not found or not exists (select 1 from public.user_roles where user_id = p_actor and role = 'practitioner') then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  else
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if p_operation in ('block', 'unblock') then
    if p_mode <> 'practice' then raise exception 'not_allowed' using errcode = '42501'; end if;
    v_type := 'availability_exception';
    if p_operation = 'block' then
      insert into public.availability_exceptions (practitioner_id, starts_at, ends_at, kind, private_reason)
      values (p_practitioner, (p_values->>'starts_at')::timestamptz, (p_values->>'ends_at')::timestamptz,
        'unavailable', nullif(left(trim(p_values->>'private_reason'), 80), ''))
      returning * into v_block;
      v_action := 'availability.exception_created';
      v_after := to_jsonb(v_block) - 'private_reason';
    else
      delete from public.availability_exceptions
      where id = p_id and practitioner_id = p_practitioner and kind = 'unavailable' returning * into v_block;
      if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
      v_action := 'availability.exception_deleted';
      v_before := to_jsonb(v_block) - 'private_reason';
    end if;
    v_id := v_block.id;
  else
    v_type := 'practice_calendar_event';
    if p_operation in ('update', 'move', 'delete') then
      select * into v_event from public.practice_calendar_events where id = p_id and external_source is null and (
        (p_mode = 'admin' and calendar_scope = 'mygrowise') or
        (p_mode = 'practice' and practitioner_id = p_practitioner and
          (calendar_scope = 'mygrowise' or (calendar_scope = 'itransform' and v_owner.slug = 'virginie')))
      ) for update;
      if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
      if v_event.updated_at is distinct from p_revision then raise exception 'agenda_changed' using errcode = '40001'; end if;
      v_before := to_jsonb(v_event);
      if v_event.calendar_scope='itransform' then v_before := v_before - array['title','location','color']; end if;
    end if;
    if p_operation in ('create', 'update') then
      if v_scope is null or (v_scope <> 'mygrowise' and
        (v_scope <> 'itransform' or p_mode <> 'practice' or v_owner.slug <> 'virginie')) then
        raise exception 'invalid_event' using errcode = '22023';
      end if;
      if (p_operation = 'create' or v_event.practitioner_id is distinct from p_practitioner)
        and not exists (select 1 from public.practitioners where id = p_practitioner and active) then
        raise exception 'invalid_input' using errcode = '22023';
      end if;
    end if;
    case p_operation
      when 'create' then
        insert into public.practice_calendar_events (title, starts_at, ends_at, event_kind, location, color, practitioner_id, calendar_scope, created_by)
        values (p_values->>'title', (p_values->>'starts_at')::timestamptz, (p_values->>'ends_at')::timestamptz,
          p_values->>'event_kind', p_values->>'location', p_values->>'color', p_practitioner, v_scope, p_actor)
        returning * into v_event;
        v_action := 'practice_calendar_event.created';
      when 'update' then
        update public.practice_calendar_events set title = p_values->>'title', starts_at = (p_values->>'starts_at')::timestamptz,
          ends_at = (p_values->>'ends_at')::timestamptz, event_kind = p_values->>'event_kind', location = p_values->>'location',
          color = p_values->>'color', practitioner_id = p_practitioner, calendar_scope = v_scope
        where id = p_id returning * into v_event;
        v_action := 'practice_calendar_event.updated';
      when 'move' then
        update public.practice_calendar_events set starts_at = (p_values->>'starts_at')::timestamptz,
          ends_at = (p_values->>'ends_at')::timestamptz where id = p_id returning * into v_event;
        v_action := 'practice_calendar_event.updated';
      when 'delete' then
        delete from public.practice_calendar_events where id = p_id;
        v_action := 'practice_calendar_event.deleted';
      else
        raise exception 'invalid_event' using errcode = '22023';
    end case;
    v_id := v_event.id;
    if p_operation <> 'delete' then v_after := to_jsonb(v_event); end if;
  end if;

  insert into public.security_audit_log(actor_user_id, action, object_type, object_id, request_id, request_path, before_snapshot, after_snapshot)
  values (p_actor, v_action, v_type, v_id::text, p_request, p_path, v_before,
    case when v_after->>'calendar_scope'='itransform' then v_after - array['title','location','color'] else v_after end);
  return coalesce(v_after, jsonb_build_object('id', v_id));
end;
$$;

-- A bounded search returns only the fields needed for appointment creation.
create function public.agenda_client_choices(p_actor uuid, p_search text, p_offset integer, p_limit integer)
returns table(id uuid, name text, email text)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.full_name, p.email
  from public.patients p
  where p.status = 'active' and p.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and public.patient_actor_can_access(p_actor, p.id)
    and (p_search = '' or strpos(lower(p.full_name), lower(p_search)) > 0 or strpos(lower(p.email), lower(p_search)) > 0)
  order by lower(p.full_name), p.id
  offset greatest(0, p_offset) limit least(101, greatest(1, p_limit));
$$;

revoke all on function public.agenda_private_occupancy(timestamptz,timestamptz,uuid),
  public.mutate_agenda_item(uuid,text,text,uuid,uuid,timestamptz,jsonb,uuid,text),
  public.agenda_client_choices(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.agenda_private_occupancy(timestamptz,timestamptz,uuid),
  public.mutate_agenda_item(uuid,text,text,uuid,uuid,timestamptz,jsonb,uuid,text),
  public.agenda_client_choices(uuid,text,integer,integer) to service_role;

-- Advance agenda revisions even across multiple writes within one transaction.
create function public.advance_agenda_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger practice_calendar_events_set_updated_at on public.practice_calendar_events;
create trigger practice_calendar_events_set_updated_at before update on public.practice_calendar_events
for each row execute function public.advance_agenda_revision();
drop trigger bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.advance_agenda_revision();
revoke all on function public.advance_agenda_revision() from public, anon, authenticated;
