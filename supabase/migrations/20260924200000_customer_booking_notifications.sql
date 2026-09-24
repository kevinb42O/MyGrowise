-- Customer-facing, in-account notifications for booking status changes.
-- The notification contains only operational booking metadata; never clinical text.

create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status_event_id bigint not null unique
    constraint customer_notifications_status_event_id_fkey
    references public.booking_status_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index customer_notifications_customer_created_idx
  on public.customer_notifications (customer_user_id, created_at desc, id desc);

create index customer_notifications_unread_idx
  on public.customer_notifications (customer_user_id, created_at desc)
  where read_at is null;

alter table public.customer_notifications enable row level security;
revoke all on public.customer_notifications from public, anon, authenticated;
grant select, update on public.customer_notifications to service_role;

create function public.create_customer_booking_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The original request is already visible in the customer's appointment list.
  -- Notify only on later status changes, and avoid notifying customers about
  -- their own cancellation action.
  if new.from_status is null or not new.customer_visible then
    return new;
  end if;

  insert into public.customer_notifications
    (customer_user_id, booking_id, status_event_id, created_at)
  select booking.customer_user_id, booking.id, new.id, new.occurred_at
  from public.bookings booking
  where booking.id = new.booking_id
    and booking.customer_user_id is not null
    and new.actor_user_id is distinct from booking.customer_user_id
  on conflict (status_event_id) do nothing;

  return new;
end;
$$;

create trigger booking_status_events_notify_customer
  after insert on public.booking_status_events
  for each row execute function public.create_customer_booking_notification();

revoke all on function public.create_customer_booking_notification() from public, anon, authenticated;
