-- MyGrowise: secure Supabase foundation
-- This migration is deliberately additive and idempotent only through the migration
-- ledger. Do not edit it after it has been applied to a shared environment.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum ('super_admin', 'practitioner', 'customer');
create type public.booking_status as enum ('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show');
create type public.product_type as enum ('module', 'guide', 'session', 'bundle');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('draft', 'pending_payment', 'paid', 'fulfilled', 'cancelled', 'partially_refunded', 'refunded', 'disputed');
create type public.entitlement_status as enum ('active', 'revoked');

-- Auth identity data stays in auth.users. This table holds only the application profile.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  timezone text not null default 'Europe/Brussels',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 120),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 64)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.practitioners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  slug text not null unique,
  name text not null,
  public_role text not null default '',
  bio text not null default '',
  expertise text[] not null default '{}',
  languages text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practitioners_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint practitioners_name_length check (char_length(name) between 2 and 80),
  constraint practitioners_public_role_length check (char_length(public_role) <= 100),
  constraint practitioners_bio_length check (char_length(bio) <= 1200),
  constraint practitioners_expertise_count check (cardinality(expertise) <= 8),
  constraint practitioners_languages_count check (cardinality(languages) <= 6)
);

create table public.practitioner_settings (
  practitioner_id uuid primary key references public.practitioners(id) on delete cascade,
  appointment_duration_minutes smallint not null default 60,
  minimum_notice_hours smallint not null default 2,
  booking_horizon_days smallint not null default 30,
  requests_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint practitioner_settings_duration check (appointment_duration_minutes in (45, 60, 75, 90)),
  constraint practitioner_settings_notice check (minimum_notice_hours in (0, 1, 2, 4, 12, 24, 48, 72)),
  constraint practitioner_settings_horizon check (booking_horizon_days in (14, 30, 45, 60, 90))
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_rules_weekday check (weekday between 1 and 7),
  constraint availability_rules_time_range check (start_time < end_time),
  unique (practitioner_id, weekday, start_time, end_time)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'unavailable',
  private_reason text,
  created_at timestamptz not null default now(),
  constraint availability_exceptions_kind check (kind in ('available', 'unavailable')),
  constraint availability_exceptions_time_range check (starts_at < ends_at),
  constraint availability_exceptions_reason_length check (char_length(coalesce(private_reason, '')) <= 200)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete restrict,
  customer_user_id uuid references public.profiles(id) on delete set null,
  client_name text not null,
  client_email text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  calendar_booked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  time_range tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  constraint bookings_client_name_length check (char_length(client_name) between 2 and 100),
  constraint bookings_client_email_length check (char_length(client_email) between 3 and 254),
  constraint bookings_time_range check (starts_at < ends_at),
  constraint bookings_active_time_no_overlap exclude using gist (
    practitioner_id with =,
    time_range with &&
  ) where (status in ('pending', 'confirmed'))
);
create index bookings_customer_start_idx on public.bookings (customer_user_id, starts_at desc);
create index bookings_practitioner_start_idx on public.bookings (practitioner_id, starts_at);
create index availability_exceptions_practitioner_time_idx on public.availability_exceptions (practitioner_id, starts_at, ends_at);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  type public.product_type not null,
  status public.product_status not null default 'draft',
  summary text not null,
  description text not null default '',
  price_cents integer,
  currency char(3) not null default 'EUR',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint products_title_length check (char_length(title) between 3 and 120),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_summary_length check (char_length(summary) between 20 and 320),
  constraint products_price check (price_cents is null or price_cents between 0 and 10000000),
  constraint products_published_price check (status <> 'published' or price_cents is not null),
  constraint products_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint products_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index products_public_list_idx on public.products (status, updated_at desc) where status = 'published';

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete restrict,
  status public.order_status not null default 'draft',
  total_cents integer not null,
  currency char(3) not null default 'EUR',
  provider text,
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total check (total_cents >= 0),
  constraint orders_currency_format check (currency ~ '^[A-Z]{3}$')
);
create index orders_customer_created_idx on public.orders (customer_user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  product_slug text not null,
  product_type public.product_type not null,
  price_cents integer not null,
  created_at timestamptz not null default now(),
  constraint order_items_price check (price_cents >= 0)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  product_slug text not null,
  product_type public.product_type not null,
  status public.entitlement_status not null default 'active',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint entitlements_revocation check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);
create index entitlements_customer_granted_idx on public.entitlements (customer_user_id, granted_at desc);
create unique index entitlements_one_active_product_idx on public.entitlements (customer_user_id, product_id) where status = 'active' and product_id is not null;

create table public.security_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  object_type text not null,
  object_id text not null,
  metadata jsonb not null default '{}',
  constraint security_audit_log_action_length check (char_length(action) between 3 and 120),
  constraint security_audit_log_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index security_audit_log_actor_time_idx on public.security_audit_log (actor_user_id, occurred_at desc);

-- Storage is private by default. The service role may write product assets; public delivery
-- requires a signed URL from a trusted server route.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-assets', 'product-assets', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger practitioners_set_updated_at before update on public.practitioners for each row execute function public.set_updated_at();
create trigger practitioner_settings_set_updated_at before update on public.practitioner_settings for each row execute function public.set_updated_at();
create trigger availability_rules_set_updated_at before update on public.availability_rules for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''));
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY DEFINER avoids RLS recursion. The empty search_path prevents object-shadowing.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

create function public.owns_practitioner(p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.practitioners
    where id = p_practitioner_id and user_id = auth.uid()
  );
$$;

-- Anonymous callers see only derived slots, not schedules, exceptions, PII, or bookings.
create function public.get_bookable_slots(p_practitioner_slug text, p_days integer default 14)
returns table (practitioner_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with selected_practitioner as (
    select p.id, s.appointment_duration_minutes, s.minimum_notice_hours, s.booking_horizon_days
    from public.practitioners p
    join public.practitioner_settings s on s.practitioner_id = p.id
    where p.slug = lower(trim(p_practitioner_slug)) and p.active and s.requests_enabled
  ), candidate_slots as (
    select
      p.id as practitioner_id,
      ((day.local_day + rule.start_time) at time zone 'Europe/Brussels')
        + (step.slot_number * make_interval(mins => p.appointment_duration_minutes)) as starts_at,
      ((day.local_day + rule.start_time) at time zone 'Europe/Brussels')
        + ((step.slot_number + 1) * make_interval(mins => p.appointment_duration_minutes)) as ends_at
    from selected_practitioner p
    join public.availability_rules rule on rule.practitioner_id = p.id
    cross join lateral generate_series(
      (timezone('Europe/Brussels', now())::date),
      (timezone('Europe/Brussels', now())::date + least(greatest(coalesce(p_days, 14), 1), p.booking_horizon_days)),
      interval '1 day'
    ) as day_value
    cross join lateral (select day_value::date as local_day) day
    cross join lateral generate_series(
      0,
      floor(extract(epoch from (rule.end_time - rule.start_time)) / 60 / p.appointment_duration_minutes)::integer - 1
    ) as step(slot_number)
    where extract(isodow from day.local_day) = rule.weekday
  )
  select candidate.practitioner_id, candidate.starts_at, candidate.ends_at
  from candidate_slots candidate
  join selected_practitioner p on p.id = candidate.practitioner_id
  where candidate.starts_at >= now() + make_interval(hours => p.minimum_notice_hours)
    and not exists (
      select 1 from public.availability_exceptions exception
      where exception.practitioner_id = candidate.practitioner_id
        and exception.kind = 'unavailable'
        and tstzrange(exception.starts_at, exception.ends_at, '[)') && tstzrange(candidate.starts_at, candidate.ends_at, '[)')
    )
    and not exists (
      select 1 from public.bookings booking
      where booking.practitioner_id = candidate.practitioner_id
        and booking.status in ('pending', 'confirmed')
        and booking.time_range && tstzrange(candidate.starts_at, candidate.ends_at, '[)')
    )
  order by candidate.starts_at;
$$;

-- The only browser-facing booking mutation. It validates the proposed slot against
-- server-side availability before insertion; the exclusion constraint closes races.
create function public.request_booking(
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
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then
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

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.owns_practitioner(uuid) to anon, authenticated, service_role;
grant execute on function public.get_bookable_slots(text, integer) to anon, authenticated, service_role;
grant execute on function public.request_booking(text, text, text, timestamptz, timestamptz) to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.practitioners enable row level security;
alter table public.practitioner_settings enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.bookings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.entitlements enable row level security;
alter table public.security_audit_log enable row level security;

create policy "profiles: users read own" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: users update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "roles: users read own" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "practitioners: public read active" on public.practitioners for select to anon, authenticated using (active or user_id = auth.uid() or public.is_admin());
create policy "practitioner settings: staff read own" on public.practitioner_settings for select to authenticated using (public.owns_practitioner(practitioner_id) or public.is_admin());
create policy "availability rules: staff read own" on public.availability_rules for select to authenticated using (public.owns_practitioner(practitioner_id) or public.is_admin());
create policy "availability exceptions: staff read own" on public.availability_exceptions for select to authenticated using (public.owns_practitioner(practitioner_id) or public.is_admin());
create policy "bookings: participants read own" on public.bookings for select to authenticated using (customer_user_id = auth.uid() or public.owns_practitioner(practitioner_id) or public.is_admin());

create policy "products: public read published" on public.products for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "orders: customer read own" on public.orders for select to authenticated using (customer_user_id = auth.uid() or public.is_admin());
create policy "order items: customer read own" on public.order_items for select to authenticated using (public.is_admin() or exists (select 1 from public.orders where orders.id = order_items.order_id and orders.customer_user_id = auth.uid()));
create policy "entitlements: customer read own" on public.entitlements for select to authenticated using (customer_user_id = auth.uid() or public.is_admin());
create policy "audit log: admin read" on public.security_audit_log for select to authenticated using (public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.practitioners, public.products to anon;
grant select on public.profiles, public.user_roles, public.practitioners, public.practitioner_settings, public.availability_rules, public.availability_exceptions, public.bookings, public.products, public.orders, public.order_items, public.entitlements, public.security_audit_log to authenticated;

-- Private object access: only a privileged server can create or retrieve signed URLs.
create policy "product assets: admin access" on storage.objects for all to authenticated using (bucket_id = 'product-assets' and public.is_admin()) with check (bucket_id = 'product-assets' and public.is_admin());
