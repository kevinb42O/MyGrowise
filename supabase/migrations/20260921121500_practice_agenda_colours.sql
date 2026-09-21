-- A calendar owner chooses the visual label colour.  The colour is presentation
-- metadata only; scheduling data stays separate from clinical records.
alter table public.practice_calendar_events
  add column color text not null default '#d26479',
  add constraint practice_calendar_events_color_format check (color ~ '^#[0-9A-Fa-f]{6}$');
