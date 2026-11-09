-- An activation belongs to one paid order item. Only hashes are stored.
create table public.ebook_licenses (
 order_item_id uuid primary key references public.order_items(id) on delete cascade,
 code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 activated_at timestamptz, created_at timestamptz not null default now()
);
create table public.ebook_files (
 product_id uuid not null references public.products(id) on delete cascade,
 format text not null check(format in ('pdf','epub')),
 bucket text not null, object_path text not null,
 filename text not null, mime text not null,
 byte_size bigint not null check(byte_size>0),
 primary key(product_id,format)
);
create table public.ebook_sessions (
 session_hash text primary key check(session_hash ~ '^[a-f0-9]{64}$'),
 order_item_id uuid not null references public.ebook_licenses(order_item_id) on delete cascade,
 expires_at timestamptz not null
);
alter table public.ebook_sessions enable row level security;
alter table public.ebook_licenses enable row level security;
alter table public.ebook_files enable row level security;
revoke all on public.ebook_licenses,public.ebook_files,public.ebook_sessions from public,anon,authenticated;
grant all on public.ebook_licenses,public.ebook_files,public.ebook_sessions to service_role;

create function public.ensure_ebook_license(p_item uuid,p_hash text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_hash !~ '^[a-f0-9]{64}$' or not exists(
  select 1 from public.order_items i join public.orders o on o.id=i.order_id join public.products p on p.id=i.product_id
  where i.id=p_item and o.status in ('paid','fulfilled') and p.type='guide' and p.metadata->>'kind'='ebook'
 ) then raise exception 'ebook_unavailable';end if;
 insert into public.ebook_licenses(order_item_id,code_hash) values(p_item,p_hash) on conflict(order_item_id) do nothing;
 if not exists(select 1 from public.ebook_licenses where order_item_id=p_item and code_hash=p_hash) then raise exception 'ebook_code_conflict';end if;
end $$;

create function public.activate_ebook_code(p_hash text,p_session text) returns text language plpgsql security invoker set search_path='' as $$
declare activated_item uuid; book_slug text;begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_session !~ '^[a-f0-9]{64}$' then return null;end if;
 -- This conditional UPDATE locks the license: concurrent attempts have one winner.
 update public.ebook_licenses l set activated_at=now()
 from public.order_items i join public.orders o on o.id=i.order_id
 where l.order_item_id=i.id and l.code_hash=p_hash and l.activated_at is null and o.status in ('paid','fulfilled')
 and exists(select 1 from public.entitlements e where e.order_item_id=i.id and e.status='active')
 returning i.id,i.product_slug into activated_item,book_slug;
 if activated_item is null then return null;end if;
 delete from public.ebook_sessions where expires_at<=now();
 insert into public.ebook_sessions(session_hash,order_item_id,expires_at) values(p_session,activated_item,now()+interval '7 days');
 return book_slug;
end $$;
revoke all on function public.ensure_ebook_license(uuid,text),public.activate_ebook_code(text,text) from public,anon,authenticated;
grant execute on function public.ensure_ebook_license(uuid,text),public.activate_ebook_code(text,text) to service_role;

-- A book purchase needs buyer contact details, not a child's date of birth.
-- All other product combinations retain their existing participant validation.
do $$declare definition text; old_validation text;new_validation text;begin
 select pg_get_functiondef('public.create_guest_catalog_order(text,uuid[],text,text,uuid,jsonb)'::regprocedure) into definition;
 old_validation:=$old$or coalesce(p_contact->>'gender','') not in ('male','female','other','unspecified') or coalesce(p_contact->>'birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or (p_contact->>'birth_date')::date>current_date$old$;
 new_validation:=$new$or coalesce(p_contact->>'gender','') not in ('male','female','other','unspecified')
 or (not (cardinality(p_ids)=1 and exists(select 1 from public.products where id=p_ids[1] and metadata->>'kind'='ebook')) and
 (coalesce(p_contact->>'birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (p_contact->>'birth_date')::date>current_date))$new$;
 if position(old_validation in definition)=0 then raise exception 'checkout_validation_changed';end if;
 execute replace(definition,old_validation,new_validation);
end $$;
