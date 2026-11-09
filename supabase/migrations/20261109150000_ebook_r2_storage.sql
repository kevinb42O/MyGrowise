alter table public.ebook_files
  add column storage_provider text not null default 'supabase'
  check (storage_provider in ('supabase', 'r2'));

-- Only this e-book can be ready without a duplicate PDF in module storage.
create or replace function public.module_ready(p_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from public.module_details d
  join public.module_releases r on r.id=d.current_release_id and r.product_id=d.product_id
  join public.products p on p.id=d.product_id
  where d.product_id=p_id and r.status='published'
   and btrim(d.audience_text)<>'' and btrim(d.access_text)<>'' and btrim(d.support_text)<>''
   and (
    (p.metadata->>'kind'='ebook' and d.format='pdf' and
     (select count(*) from public.ebook_files f where f.product_id=p.id and f.storage_provider='r2')=2)
    or
    ((d.format='audio' or exists(select 1 from public.module_assets a where a.release_id=r.id and a.kind='pdf' and a.status='verified'))
     and (d.format='pdf' or exists(select 1 from public.module_assets a where a.release_id=r.id and a.kind='audio' and a.status='verified'))
     and not exists(select 1 from public.module_assets a where a.release_id=r.id and a.status<>'verified'))
   )
 );
$$;
