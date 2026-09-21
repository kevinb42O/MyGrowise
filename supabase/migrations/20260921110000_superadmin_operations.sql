-- Superadmin operations layer. All writes are performed by trusted server routes
-- using the secret API key; browser roles have no mutation privileges.

alter type public.app_role add value if not exists 'admin';
alter type public.app_role add value if not exists 'content_editor';
alter type public.app_role add value if not exists 'clinical_reviewer';
alter type public.app_role add value if not exists 'support';
alter type public.app_role add value if not exists 'analyst';
alter type public.product_type add value if not exists 'profile';
alter type public.product_type add value if not exists 'ebook';
alter type public.product_status add value if not exists 'review';

create table public.admin_work_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  priority smallint not null default 2,
  status text not null default 'open',
  object_type text,
  object_id text,
  due_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}',
  constraint admin_work_items_title_length check (char_length(title) between 3 and 240),
  constraint admin_work_items_category check (category in ('payment', 'delivery', 'booking', 'content', 'support', 'privacy', 'system')),
  constraint admin_work_items_priority check (priority between 1 and 4),
  constraint admin_work_items_status check (status in ('open', 'in_progress', 'blocked', 'resolved')),
  constraint admin_work_items_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index admin_work_items_queue_idx on public.admin_work_items (status, priority, due_at nulls last, created_at);

create table public.integration_status (
  key text primary key,
  label text not null,
  state text not null default 'not_configured',
  last_checked_at timestamptz,
  detail text,
  updated_at timestamptz not null default now(),
  constraint integration_status_key check (key in ('payments', 'email', 'analytics', 'booking', 'storage')),
  constraint integration_status_state check (state in ('healthy', 'degraded', 'not_configured', 'failed')),
  constraint integration_status_label_length check (char_length(label) between 2 and 80),
  constraint integration_status_detail_length check (char_length(coalesce(detail, '')) <= 500)
);
create trigger integration_status_set_updated_at before update on public.integration_status for each row execute function public.set_updated_at();

insert into public.integration_status (key, label, state, detail) values
  ('payments', 'Betalingen', 'not_configured', 'Er is nog geen betaalprovider gekoppeld.'),
  ('email', 'E-mail', 'not_configured', 'Configureer productie-SMTP voordat je gebruikers uitnodigt.'),
  ('analytics', 'Analytics', 'not_configured', 'De privacyvriendelijke eventlaag is nog niet geactiveerd.'),
  ('booking', 'Boekingen', 'healthy', 'Server-side slotvalidatie en dubbelboekingsbescherming zijn actief.'),
  ('storage', 'Bestandsopslag', 'healthy', 'De private product-assets-bucket is beschikbaar.')
on conflict (key) do nothing;

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_name text not null,
  anonymous_id uuid,
  path text,
  route_key text,
  product_id uuid references public.products(id) on delete set null,
  practitioner_id uuid references public.practitioners(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount_cents integer,
  currency char(3),
  consented boolean not null default false,
  environment text not null default 'production',
  schema_version smallint not null default 1,
  metadata jsonb not null default '{}',
  constraint analytics_events_name check (event_name in ('page_view', 'route_selected', 'product_viewed', 'checkout_started', 'payment_succeeded', 'payment_failed', 'payment_refunded', 'entitlement_delivered', 'professional_viewed', 'booking_clicked', 'booking_confirmed', 'content_published')),
  constraint analytics_events_path_length check (char_length(coalesce(path, '')) <= 500),
  constraint analytics_events_route_key check (route_key is null or route_key in ('self', 'care')),
  constraint analytics_events_amount check (amount_cents is null or amount_cents >= 0),
  constraint analytics_events_currency check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint analytics_events_environment check (environment in ('preview', 'production')),
  constraint analytics_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index analytics_events_reporting_idx on public.analytics_events (occurred_at desc, event_name) where consented;

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid references public.profiles(id) on delete set null,
  request_type text not null,
  status text not null default 'received',
  received_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  resolved_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null,
  internal_note text not null default '',
  constraint data_subject_requests_type check (request_type in ('access', 'correction', 'erasure', 'portability', 'objection')),
  constraint data_subject_requests_status check (status in ('received', 'in_progress', 'resolved', 'rejected')),
  constraint data_subject_requests_note_length check (char_length(internal_note) <= 2000)
);
create index data_subject_requests_queue_idx on public.data_subject_requests (status, due_at);

alter table public.admin_work_items enable row level security;
alter table public.integration_status enable row level security;
alter table public.analytics_events enable row level security;
alter table public.data_subject_requests enable row level security;

create policy "admin work items: admin read" on public.admin_work_items for select to authenticated using (public.is_admin());
create policy "integration status: admin read" on public.integration_status for select to authenticated using (public.is_admin());
create policy "analytics events: admin read" on public.analytics_events for select to authenticated using (public.is_admin());
create policy "data requests: admin read" on public.data_subject_requests for select to authenticated using (public.is_admin());

grant select on public.admin_work_items, public.integration_status, public.analytics_events, public.data_subject_requests to authenticated;
