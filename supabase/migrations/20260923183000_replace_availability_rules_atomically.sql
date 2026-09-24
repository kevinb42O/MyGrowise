-- Availability must never be temporarily or permanently emptied when a write
-- fails between deletion and insertion. Keep validation and replacement in one
-- database transaction; only the trusted server role may invoke it.
create function public.replace_availability_rules(p_practitioner_id uuid, p_rules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 28 then
    raise exception 'Invalid availability rules' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rules) as rule(weekday smallint, start_time time, end_time time)
    where weekday not between 1 and 7 or start_time >= end_time
  ) then
    raise exception 'Invalid availability rule' using errcode = '22023';
  end if;

  if exists (
    with rules as (
      select row_number() over () as position, weekday, start_time, end_time
      from jsonb_to_recordset(p_rules) as rule(weekday smallint, start_time time, end_time time)
    )
    select 1 from rules left_rule join rules right_rule
      on left_rule.weekday = right_rule.weekday
      and left_rule.position < right_rule.position
      and left_rule.start_time < right_rule.end_time
      and right_rule.start_time < left_rule.end_time
  ) then
    raise exception 'Overlapping availability rules' using errcode = '22023';
  end if;

  delete from public.availability_rules where practitioner_id = p_practitioner_id;
  insert into public.availability_rules (practitioner_id, weekday, start_time, end_time)
  select p_practitioner_id, weekday, start_time, end_time
  from jsonb_to_recordset(p_rules) as rule(weekday smallint, start_time time, end_time time);
end;
$$;

revoke all on function public.replace_availability_rules(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_availability_rules(uuid, jsonb) to service_role;
