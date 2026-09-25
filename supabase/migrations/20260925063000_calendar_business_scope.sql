-- Keep MyGrowise and Praktijk Itransform moments in one calendar without
-- exposing Itransform's schedule to other practitioners.
alter table public.practice_calendar_events
  add column calendar_scope text not null default 'itransform';
alter table public.practice_calendar_events
  add constraint practice_calendar_events_scope_check
  check (calendar_scope in ('mygrowise', 'itransform'));

-- Before this split, staff-created private moments were stored as Itransform
-- events. Preserve them in each employee's own MyGrowise calendar.
update public.practice_calendar_events e
set calendar_scope = 'mygrowise'
where e.practitioner_id is not null
  and not exists (
    select 1 from public.practitioners p
    where p.id = e.practitioner_id and p.slug = 'virginie'
  );

create index practice_calendar_events_scope_range_idx
  on public.practice_calendar_events (calendar_scope, starts_at, ends_at)
  where status = 'confirmed';
