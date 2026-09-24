-- Durable preferences, legacy audit idempotency, and a server-only cancellation
-- transition complete the move from the local SQLite account store.
create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  booking_email_enabled boolean not null default true,
  booking_reminder_enabled boolean not null default true,
  weekly_digest_enabled boolean not null default false,
  timezone text not null default 'Europe/Brussels',
  updated_at timestamptz not null default now(),
  constraint user_preferences_timezone_length check (char_length(timezone) between 1 and 64)
);

create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
create policy "preferences: users read own" on public.user_preferences for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke all on public.user_preferences from anon, authenticated;
grant select on public.user_preferences to authenticated;

alter table public.security_audit_log add column legacy_source_id text unique;
alter table public.security_audit_log add constraint security_audit_log_legacy_source_id_length
  check (legacy_source_id is null or char_length(legacy_source_id) between 1 and 128);

create function public.cancel_customer_booking(p_booking_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_notice_hours smallint;
begin
  select booking.* into v_booking
  from public.bookings booking
  where booking.id = p_booking_id and booking.customer_user_id = p_customer_id
  for update;
  if not found or v_booking.status not in ('pending', 'confirmed') then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  select minimum_notice_hours into v_notice_hours
  from public.practitioner_settings
  where practitioner_id = v_booking.practitioner_id;
  if v_booking.starts_at < now() + make_interval(hours => coalesce(v_notice_hours, 2)) then
    raise exception 'Cancellation is too late' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;
  insert into public.security_audit_log (actor_user_id, action, object_type, object_id)
  values (p_customer_id, 'booking.cancelled_by_customer', 'booking', p_booking_id::text);
end;
$$;

revoke all on function public.cancel_customer_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_customer_booking(uuid, uuid) to service_role;
