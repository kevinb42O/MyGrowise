-- Versioned, reviewable editorial content. Public rendering is performed by
-- trusted server routes; browser clients never receive unpublished records.

create type public.content_kind as enum ('article', 'page');
create type public.content_status as enum ('draft', 'review', 'published', 'archived');

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  status public.content_status not null default 'draft',
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  body jsonb not null default '{"text":""}'::jsonb,
  seo_title text not null default '',
  seo_description text not null default '',
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_items_title_length check (char_length(title) between 3 and 160),
  constraint content_items_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint content_items_excerpt_length check (char_length(excerpt) <= 360),
  constraint content_items_seo_title_length check (char_length(seo_title) <= 70),
  constraint content_items_seo_description_length check (char_length(seo_description) <= 170),
  constraint content_items_body_object check (jsonb_typeof(body) = 'object'),
  constraint content_items_publication_timestamp check ((status = 'published' and published_at is not null) or status <> 'published')
);

create index content_items_public_idx on public.content_items (kind, published_at desc) where status = 'published';
create index content_items_admin_idx on public.content_items (status, updated_at desc);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  version_number integer not null,
  status public.content_status not null,
  title text not null,
  slug text not null,
  excerpt text not null,
  body jsonb not null,
  seo_title text not null,
  seo_description text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint content_versions_number check (version_number > 0),
  constraint content_versions_body_object check (jsonb_typeof(body) = 'object'),
  unique (content_id, version_number)
);
create index content_versions_history_idx on public.content_versions (content_id, version_number desc);

create table public.content_redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  content_id uuid not null references public.content_items(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint content_redirects_path_format check (from_path ~ '^/[a-z0-9]+(?:[/-][a-z0-9]+)*$')
);

create function public.snapshot_content_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.content_versions (
    content_id, version_number, status, title, slug, excerpt, body,
    seo_title, seo_description, changed_by
  )
  select new.id,
    coalesce((select max(version_number) + 1 from public.content_versions where content_id = new.id), 1),
    new.status, new.title, new.slug, new.excerpt, new.body,
    new.seo_title, new.seo_description, new.updated_by;
  return new;
end;
$$;

create trigger content_items_set_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();
create trigger content_items_snapshot_version after insert or update on public.content_items
  for each row execute function public.snapshot_content_version();

alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.content_redirects enable row level security;

create policy "content items: superadmin read" on public.content_items for select to authenticated using (public.is_admin());
create policy "content versions: superadmin read" on public.content_versions for select to authenticated using (public.is_admin());
create policy "content redirects: superadmin read" on public.content_redirects for select to authenticated using (public.is_admin());

grant select on public.content_items, public.content_versions, public.content_redirects to authenticated;
