-- Keep account notifications aligned with direct confirmed booking and customer
-- cancellation, as well as the existing staff updates and reschedule events.
create or replace function public.create_customer_booking_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not new.customer_visible then return new; end if;
 -- Historical pending requests remain historical; new confirmed bookings notify.
 if new.from_status is null and new.to_status<>'confirmed' and not exists(
   select 1 from public.bookings b where b.id=new.booking_id and b.origin='staff'
 ) then return new; end if;
 insert into public.customer_notifications(customer_user_id,booking_id,status_event_id,created_at)
 select b.customer_user_id,b.id,new.id,new.occurred_at from public.bookings b
 where b.id=new.booking_id and b.customer_user_id is not null
 on conflict(status_event_id) do nothing;
 return new;
end; $$;
revoke all on function public.create_customer_booking_notification() from public,anon,authenticated,service_role;
