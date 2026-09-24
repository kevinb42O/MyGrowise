-- A double-escaped dot made the original POSIX regex expect a literal
-- backslash in every address. Use a character class so valid customer email
-- addresses are accepted by the public booking RPC.
create or replace function public.request_booking(
  p_practitioner_slug text,
  p_client_name text,
  p_client_email text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_practitioner_id uuid;
  v_booking_id uuid;
  v_name text := trim(p_client_name);
  v_email text := lower(trim(p_client_email));
begin
  if char_length(v_name) not between 2 and 100
    or char_length(v_email) not between 3 and 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Invalid booking contact details' using errcode = '22023';
  end if;

  select slot.practitioner_id into v_practitioner_id
  from public.get_bookable_slots(p_practitioner_slug, 90) slot
  where slot.starts_at = p_starts_at and slot.ends_at = p_ends_at
  limit 1;

  if v_practitioner_id is null then
    raise exception 'Requested slot is unavailable' using errcode = 'P0001';
  end if;

  insert into public.bookings (practitioner_id, customer_user_id, client_name, client_email, starts_at, ends_at)
  values (v_practitioner_id, auth.uid(), v_name, v_email, p_starts_at, p_ends_at)
  returning id into v_booking_id;

  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, metadata)
  values (auth.uid(), 'booking.requested', 'booking', v_booking_id::text, jsonb_build_object('practitioner_id', v_practitioner_id));

  return v_booking_id;
end;
$$;
