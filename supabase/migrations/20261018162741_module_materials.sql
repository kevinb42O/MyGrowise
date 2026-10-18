-- Modules share products, prices, orders and purchase rights with the catalog.
create table public.module_details (
 product_id uuid primary key references public.products(id) on delete restrict,
 series text not null default 'innerlijk-landschap', number integer not null check(number between 1 and 6),
 subtitle text not null default '', tagline text not null default '', introduction text[] not null default '{}', topics text[] not null default '{}',
 audience_text text not null default '', access_text text not null default '', support_text text not null default '',
 image_alt text not null default '', current_release_id uuid, revision integer not null default 1,
 unique(series,number), check(cardinality(introduction)<=12 and cardinality(topics)<=20)
);
create table public.module_releases (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.module_details(product_id),
 status text not null default 'draft' check(status in ('draft','published')), revision integer not null default 1,
 created_at timestamptz not null default now(), published_at timestamptz, checked_by uuid references public.profiles(id),
 unique(id,product_id), check((status='draft' and published_at is null) or (status='published' and published_at is not null))
);
create unique index module_one_draft on public.module_releases(product_id) where status='draft';
alter table public.module_details add foreign key(current_release_id,product_id) references public.module_releases(id,product_id);
create table public.module_tracks (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.module_details(product_id),
 key text not null check(key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(key)<=80),
 unique(product_id,key), unique(id,product_id)
);
create table public.module_assets (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.module_details(product_id),
 release_id uuid not null, kind text not null check(kind in ('pdf','audio')), track_id uuid,
 title text not null check(length(btrim(title)) between 1 and 160), sort_order integer not null default 0 check(sort_order between 0 and 999),
 object_path text not null, mime text not null check(mime in ('application/pdf','audio/mpeg')),
 byte_size bigint not null check(byte_size>0 and byte_size<=157286400), duration_seconds numeric,
 status text not null default 'reserved' check(status in ('reserved','verified')), created_at timestamptz not null default now(),
 foreign key(release_id,product_id) references public.module_releases(id,product_id),
 foreign key(track_id,product_id) references public.module_tracks(id,product_id),
 check((kind='pdf' and track_id is null and mime='application/pdf' and byte_size<=26214400) or (kind='audio' and track_id is not null and mime='audio/mpeg')),
 check(duration_seconds is null or (duration_seconds>0 and duration_seconds<=86400)),
 check(object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|mp3)$')
);
create unique index module_one_pdf on public.module_assets(release_id) where kind='pdf';
create unique index module_release_track on public.module_assets(release_id,track_id) where kind='audio';
create index module_track_assets on public.module_assets(track_id);
create index module_release_product on public.module_releases(product_id);
create index module_assets_product on public.module_assets(product_id);
create index module_details_release on public.module_details(current_release_id);
create index module_releases_checker on public.module_releases(checked_by);
alter table public.module_details enable row level security;
alter table public.module_releases enable row level security;
alter table public.module_tracks enable row level security;
alter table public.module_assets enable row level security;
revoke all on public.module_details,public.module_releases,public.module_tracks,public.module_assets from public,anon,authenticated;
grant all on public.module_details,public.module_releases,public.module_tracks,public.module_assets to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('module-materials','module-materials',false,157286400,array['application/pdf','audio/mpeg']);

create function public.module_ready(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.module_details d join public.module_releases r on r.id=d.current_release_id and r.product_id=d.product_id
 where d.product_id=p_id and r.status='published' and btrim(d.audience_text)<>'' and btrim(d.access_text)<>'' and btrim(d.support_text)<>''
 and exists(select 1 from public.module_assets a where a.release_id=r.id and a.kind='pdf' and a.status='verified')
 and exists(select 1 from public.module_assets a where a.release_id=r.id and a.kind='audio' and a.status='verified')
 and not exists(select 1 from public.module_assets a where a.release_id=r.id and a.status<>'verified'));
$$;
create function public.guard_module_sale() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.availability='available' and exists(select 1 from public.products where id=new.product_id and type='module') and not public.module_ready(new.product_id) then raise exception 'module_not_ready'; end if;
 return new;
end $$;
create trigger module_sale_ready before insert or update on public.catalog_details for each row execute function public.guard_module_sale();
-- Keep the existing landing-content editor implementation, extending its accepted type.
do $$declare definition text;begin
 select pg_get_functiondef('public.save_catalog_product(uuid,jsonb)'::regprocedure) into definition;
 if position('if v_type not in (''profile'',''questionnaire'')' in definition)=0 then raise exception 'catalog_save_version_mismatch';end if;
 execute replace(definition,'if v_type not in (''profile'',''questionnaire'')','if v_type not in (''profile'',''questionnaire'',''module'')');
end $$;

create function public.save_module(p_actor uuid,p_id uuid,p_revision integer,p_data jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare v_details public.module_details%rowtype; v_catalog jsonb; v_key text;begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(104041511);
 select * into v_details from public.module_details where product_id=p_id for update;
 if not found or v_details.revision<>p_revision then raise exception 'revision_conflict';end if;
 if not exists(select 1 from public.products where id=p_id and type='module') then raise exception 'invalid_module';end if;
 foreach v_key in array array['subtitle','tagline','audienceText','accessText','supportText','imageAlt'] loop
  if jsonb_typeof(p_data->v_key) is distinct from 'string' or length(p_data->>v_key)>2000 then raise exception 'invalid_module_content';end if;
 end loop;
 foreach v_key in array array['introduction','topics'] loop
  if jsonb_typeof(p_data->v_key) is distinct from 'array' then raise exception 'invalid_module_content';end if;
  if jsonb_array_length(p_data->v_key)>20 or exists(select 1 from jsonb_array_elements(p_data->v_key) x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>3000 or btrim(x#>>'{}')='') then raise exception 'invalid_module_content';end if;
 end loop;
 update public.module_details set subtitle=p_data->>'subtitle',tagline=p_data->>'tagline',introduction=array(select jsonb_array_elements_text(p_data->'introduction')),topics=array(select jsonb_array_elements_text(p_data->'topics')),audience_text=p_data->>'audienceText',access_text=p_data->>'accessText',support_text=p_data->>'supportText',image_alt=p_data->>'imageAlt',revision=revision+1 where product_id=p_id;
 v_catalog:=p_data->'catalog';
 if v_catalog->>'id' is distinct from p_id::text or v_catalog->>'type' is distinct from 'module' then raise exception 'invalid_module';end if;
 perform public.save_catalog_product(p_actor,v_catalog);
end $$;

create function public.begin_module_release(p_actor uuid,p_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_current uuid;begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 select current_release_id into v_current from public.module_details where product_id=p_id for update;
 if not found then raise exception 'not_found';end if;
 select id into v_id from public.module_releases where product_id=p_id and status='draft';
 if v_id is not null then return v_id;end if;
 insert into public.module_releases(product_id) values(p_id) returning id into v_id;
 if v_current is not null then
  insert into public.module_assets(product_id,release_id,kind,track_id,title,sort_order,object_path,mime,byte_size,duration_seconds,status)
   select product_id,v_id,kind,track_id,title,sort_order,object_path,mime,byte_size,duration_seconds,status from public.module_assets where release_id=v_current;
 end if;
 return v_id;
end $$;

create function public.reserve_module_asset(p_actor uuid,p_release uuid,p_revision integer,p_kind text,p_key text,p_title text,p_size bigint,p_sort integer) returns public.module_assets
language plpgsql security invoker set search_path='' as $$
declare r public.module_releases%rowtype; t uuid; a public.module_assets%rowtype; asset_id uuid:=gen_random_uuid();begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 select * into r from public.module_releases where id=p_release for update;
 if not found or r.status<>'draft' or r.revision<>p_revision then raise exception 'revision_conflict';end if;
 if p_kind not in ('pdf','audio') then raise exception 'invalid_asset';end if;
 if p_kind='audio' then
  insert into public.module_tracks(product_id,key) values(r.product_id,p_key) on conflict(product_id,key) do nothing;
  select id into t from public.module_tracks where product_id=r.product_id and key=p_key;
 end if;
 delete from public.module_assets where release_id=r.id and (p_kind='pdf' and kind='pdf' or p_kind='audio' and track_id=t);
 insert into public.module_assets(id,product_id,release_id,kind,track_id,title,sort_order,object_path,mime,byte_size)
 values(asset_id,r.product_id,r.id,p_kind,t,p_title,p_sort,r.product_id::text||'/'||r.id::text||'/'||asset_id::text||case when p_kind='pdf' then '.pdf' else '.mp3' end,case when p_kind='pdf' then 'application/pdf' else 'audio/mpeg' end,p_size) returning * into a;
 update public.module_releases set revision=revision+1 where id=r.id;
 return a;
end $$;

create function public.verify_module_asset(p_actor uuid,p_asset uuid) returns void language plpgsql security invoker set search_path='' as $$
declare r public.module_releases%rowtype;begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 select r0.* into r from public.module_releases r0 join public.module_assets a on a.release_id=r0.id where a.id=p_asset for update of r0;
 if not found or r.status<>'draft' then raise exception 'invalid_asset';end if;
 update public.module_assets set status='verified' where id=p_asset;
 update public.module_releases set revision=revision+1 where id=r.id;
end $$;

create function public.edit_module_asset(p_actor uuid,p_asset uuid,p_revision integer,p_title text,p_sort integer,p_remove boolean) returns void language plpgsql security invoker set search_path='' as $$
declare r public.module_releases%rowtype;begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 select r0.* into r from public.module_releases r0 join public.module_assets a on a.release_id=r0.id where a.id=p_asset for update of r0;
 if not found or r.status<>'draft' or r.revision<>p_revision then raise exception 'revision_conflict';end if;
 if p_remove then delete from public.module_assets where id=p_asset;else update public.module_assets set title=p_title,sort_order=p_sort where id=p_asset;end if;
 update public.module_releases set revision=revision+1 where id=r.id;
end $$;

create function public.publish_module_release(p_actor uuid,p_release uuid,p_revision integer,p_checked boolean) returns void language plpgsql security invoker set search_path='' as $$
declare r public.module_releases%rowtype;begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(104041511);
 select * into r from public.module_releases where id=p_release for update;
 if not found or r.status<>'draft' or r.revision<>p_revision then raise exception 'revision_conflict';end if;
 if p_checked is distinct from true or not exists(select 1 from public.module_assets where release_id=r.id and kind='pdf' and status='verified') or not exists(select 1 from public.module_assets where release_id=r.id and kind='audio' and status='verified') or exists(select 1 from public.module_assets where release_id=r.id and status<>'verified') then raise exception 'module_incomplete';end if;
 update public.module_releases set status='published',published_at=now(),checked_by=p_actor,revision=revision+1 where id=r.id;
 update public.module_details set current_release_id=r.id,revision=revision+1 where product_id=r.product_id;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,metadata) values(p_actor,'module.material_published','product',r.product_id::text,jsonb_build_object('release',r.id));
end $$;

-- Functions are server-only; even invoker functions check the real actor role.
revoke all on function public.module_ready(uuid),public.guard_module_sale(),public.save_module(uuid,uuid,integer,jsonb),public.begin_module_release(uuid,uuid),public.reserve_module_asset(uuid,uuid,integer,text,text,text,bigint,integer),public.verify_module_asset(uuid,uuid),public.edit_module_asset(uuid,uuid,integer,text,integer,boolean),public.publish_module_release(uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.module_ready(uuid),public.guard_module_sale(),public.save_module(uuid,uuid,integer,jsonb),public.begin_module_release(uuid,uuid),public.reserve_module_asset(uuid,uuid,integer,text,text,text,bigint,integer),public.verify_module_asset(uuid,uuid),public.edit_module_asset(uuid,uuid,integer,text,integer,boolean),public.publish_module_release(uuid,uuid,integer,boolean) to service_role;

-- Catalog checkout requires a positive payable price.
create or replace function public.catalog_quote(p_ids uuid[], p_mode text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_settings public.catalog_pricing%rowtype; v_row record; v_items jsonb:='[]'; v_item jsonb; v_sub integer:=0; v_pct integer:=0; v_total integer; v_quote jsonb; v_count integer;
begin
 perform pg_advisory_xact_lock(104041511);
 select * into v_settings from public.catalog_pricing where id=true;
 v_count:=cardinality(p_ids);
 if p_mode not in ('package','custom') or v_count is null or v_count<1 or v_count>30 or v_count<>(select count(distinct x) from unnest(p_ids) x) or (p_mode='package' and v_count<>1) then raise exception 'invalid_selection'; end if;
 for v_row in select p.*,d.availability,d.delivery_text,d.updated_at as detail_updated from public.products p join public.catalog_details d on d.product_id=p.id where p.id=any(p_ids) order by p.id loop
  if v_row.status<>'published' or v_row.availability<>'available' or v_row.price_cents is null or v_row.price_cents<=0 or v_row.currency<>'EUR' or (p_mode='custom' and v_row.type not in ('questionnaire','module')) or (p_mode='package' and v_row.type<>'profile') then raise exception 'unavailable_product'; end if;
  if v_row.type='module' and not public.module_ready(v_row.id) then raise exception 'module_not_ready';end if;
  v_item:=jsonb_build_object('id',v_row.id,'slug',v_row.slug,'title',v_row.title,'type',v_row.type,'listPriceCents',v_row.price_cents,'deliveryText',v_row.delivery_text,'revision',v_row.updated_at::text||v_row.detail_updated::text||coalesce((select current_release_id::text from public.module_details where product_id=v_row.id),''),'moduleRelease',case when v_row.type='module' then (select current_release_id from public.module_details where product_id=v_row.id) else null end,'components',coalesce((select jsonb_agg(jsonb_build_object('key',c.id,'id',c.questionnaire_id,'title',c.label) order by c.sort_order,c.id) from public.catalog_components c where c.package_id=v_row.id),'[]'::jsonb));
  if p_mode='package' and jsonb_array_length(v_item->'components')=0 then raise exception 'empty_package'; end if;
  v_items:=v_items||jsonb_build_array(v_item); v_sub:=v_sub+v_row.price_cents;
 end loop;
 if jsonb_array_length(v_items)<>v_count then raise exception 'unavailable_product'; end if;
 if p_mode='custom' then v_pct:=case when v_count>=v_settings.large_min then v_settings.large_percent when v_count>=v_settings.medium_min then v_settings.medium_percent else 0 end; end if;
 v_total:=floor((v_sub::bigint*(100-v_pct)+50)/100.0)::integer;
 -- Largest remainder: payable lines sum exactly to the rounded final total.
 select jsonb_agg(item||jsonb_build_object('priceCents',base+case when rn<=v_total-sum_base then 1 else 0 end) order by item->>'id') into v_items from (
  select item,base,row_number() over(order by remainder desc,item->>'id') rn,sum(base) over() sum_base from (
   select value item,floor((value->>'listPriceCents')::bigint*(100-v_pct)/100.0)::integer base,mod((value->>'listPriceCents')::bigint*(100-v_pct),100) remainder from jsonb_array_elements(v_items)
  ) b
 ) a;
 v_quote:=jsonb_build_object('mode',p_mode,'items',v_items,'subtotalCents',v_sub,'discountPercent',v_pct,'discountCents',v_sub-v_total,'totalCents',v_total,'currency','EUR','settingsRevision',v_settings.updated_at);
 return v_quote||jsonb_build_object('hash',md5(v_quote::text));
end $$;

revoke all on function public.catalog_quote(uuid[],text) from public,anon,authenticated;
grant execute on function public.catalog_quote(uuid[],text) to service_role;

-- Preserve submission idempotency; prevent accidental duplicate paid/pending module purchases.
do $$declare definition text;begin
 select pg_get_functiondef('public.create_catalog_order(uuid,uuid[],text,text,uuid)'::regprocedure) into definition;
 definition:=replace(definition, 'insert into public.orders(customer_user_id,status,total_cents,currency,provider,provider_reference,catalog_quote,submission_key)',
 'if exists(select 1 from public.entitlements where customer_user_id=p_customer_id and product_type=''module'' and product_id=any(p_ids) and status=''active'') then raise exception ''module_already_owned'';end if;
 select o.* into v_existing from public.orders o where o.customer_user_id=p_customer_id and o.status=''pending_payment'' and exists(select 1 from public.order_items i where i.order_id=o.id and i.product_type=''module'' and i.product_id=any(p_ids)) order by o.created_at desc limit 1;
 if found then
  if v_existing.catalog_quote->>''hash''=v_quote->>''hash'' then return v_existing.id;end if;
  raise exception ''module_pending_order'';
 end if;
 insert into public.orders(customer_user_id,status,total_cents,currency,provider,provider_reference,catalog_quote,submission_key)');
 execute definition;
end $$;

-- Author-supplied content. Materials are not supplied, so every module starts upcoming.
do $$declare product uuid;begin
insert into public.products(title,slug,type,status,summary,price_cents,currency) values('Het Meer','het-meer','module','published','Wat is stress eigenlijk? Waarom reageert je lichaam soms al voordat je zelf begrijpt wat er gebeurt? Je leert lichamelijke, emotionele en cognitieve signalen herkennen en ontdekt welke hulpbronnen zich in jouw meer bevinden.',8900,'EUR') on conflict(slug) do nothing;
select id into product from public.products where slug='het-meer' and type='module'; if product is null then raise exception 'module_slug_conflict';end if;
insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order) values(product,'Online module','','','','upcoming','Je reis begint aan de oever van het meer. Je leert kijken naar de bewegingen van het water en ontdekt wat jouw lichaam je probeert duidelijk te maken.

Wat is stress eigenlijk? Waarom reageert je lichaam soms al voordat je zelf begrijpt wat er gebeurt? Je leert lichamelijke, emotionele en cognitieve signalen herkennen en ontdekt welke hulpbronnen zich in jouw meer bevinden.','PDF met uitleg en oefeningen, met bijbehorende audio.','Na bevestiging van je betaling open je de module in je bibliotheek.','Doelgroep, toegangsduur en ondersteuning nog in te vullen; materiaal nog aan te leveren.','/images/editorial/mygrowise-74.jpg',201) on conflict(product_id) do nothing;
insert into public.module_details(product_id,number,subtitle,tagline,introduction,topics) values(product,1,'Herken wat je lichaam je vertelt','Waar je lichaam spreekt',array['Je reis begint aan de oever van het meer. Je leert kijken naar de bewegingen van het water en ontdekt wat jouw lichaam je probeert duidelijk te maken.','Wat is stress eigenlijk? Waarom reageert je lichaam soms al voordat je zelf begrijpt wat er gebeurt? Je leert lichamelijke, emotionele en cognitieve signalen herkennen en ontdekt welke hulpbronnen zich in jouw meer bevinden.']::text[],array['Stress begrijpen','Fysiologische stressreacties','Lichaamsbewustzijn','Stresssignalen','Hulpbronnen']::text[]) on conflict(product_id) do nothing;
end $$;
do $$declare product uuid;begin
insert into public.products(title,slug,type,status,summary,price_cents,currency) values('De Stromingen','de-stromingen','module','published','Ook jij hebt automatische manieren ontwikkeld om met stress, emoties en moeilijke situaties om te gaan. Je onderzoekt jouw reactiepatronen en leert begrijpen waarom je soms terugvalt op vertrouwde gewoontes.',8900,'EUR') on conflict(slug) do nothing;
select id into product from public.products where slug='de-stromingen' and type='module'; if product is null then raise exception 'module_slug_conflict';end if;
insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order) values(product,'Online module','','','','upcoming','Onder het wateroppervlak bevinden zich stromingen die je niet altijd kunt zien. Sommige brengen je telkens opnieuw in dezelfde richting.

Ook jij hebt automatische manieren ontwikkeld om met stress, emoties en moeilijke situaties om te gaan. Je onderzoekt jouw reactiepatronen en leert begrijpen waarom je soms terugvalt op vertrouwde gewoontes.','PDF met uitleg en oefeningen, met bijbehorende audio.','Na bevestiging van je betaling open je de module in je bibliotheek.','Doelgroep, toegangsduur en ondersteuning nog in te vullen; materiaal nog aan te leveren.','/images/editorial/mygrowise-74.jpg',202) on conflict(product_id) do nothing;
insert into public.module_details(product_id,number,subtitle,tagline,introduction,topics) values(product,2,'Ontdek hoe jij met stress omgaat','De patronen onder het oppervlak',array['Onder het wateroppervlak bevinden zich stromingen die je niet altijd kunt zien. Sommige brengen je telkens opnieuw in dezelfde richting.','Ook jij hebt automatische manieren ontwikkeld om met stress, emoties en moeilijke situaties om te gaan. Je onderzoekt jouw reactiepatronen en leert begrijpen waarom je soms terugvalt op vertrouwde gewoontes.']::text[],array['Copingstijlen','Automatische stressreacties','Gedragspatronen','Gedachten, gevoelens en gedrag']::text[]) on conflict(product_id) do nothing;
end $$;
do $$declare product uuid;begin
insert into public.products(title,slug,type,status,summary,price_cents,currency) values('De Mist','de-mist','module','published','Angst en piekeren kunnen op dezelfde manier je blik beïnvloeden. Je ontdekt hoe angst en piekergedachten werken en oefent met manieren om anders om te gaan met onzekerheid, controlebehoefte en vermijding.',8900,'EUR') on conflict(slug) do nothing;
select id into product from public.products where slug='de-mist' and type='module'; if product is null then raise exception 'module_slug_conflict';end if;
insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order) values(product,'Online module','','','','upcoming','Soms trekt er mist over het landschap. Wat eerst duidelijk leek, wordt onzeker. Je gedachten proberen in te vullen wat je niet kunt zien.

Angst en piekeren kunnen op dezelfde manier je blik beïnvloeden. Je ontdekt hoe angst en piekergedachten werken en oefent met manieren om anders om te gaan met onzekerheid, controlebehoefte en vermijding.','PDF met uitleg en oefeningen, met bijbehorende audio.','Na bevestiging van je betaling open je de module in je bibliotheek.','Doelgroep, toegangsduur en ondersteuning nog in te vullen; materiaal nog aan te leveren.','/images/editorial/mygrowise-74.jpg',203) on conflict(product_id) do nothing;
insert into public.module_details(product_id,number,subtitle,tagline,introduction,topics) values(product,3,'Omgaan met angst en piekeren','Wanneer onzekerheid het zicht vertroebelt',array['Soms trekt er mist over het landschap. Wat eerst duidelijk leek, wordt onzeker. Je gedachten proberen in te vullen wat je niet kunt zien.','Angst en piekeren kunnen op dezelfde manier je blik beïnvloeden. Je ontdekt hoe angst en piekergedachten werken en oefent met manieren om anders om te gaan met onzekerheid, controlebehoefte en vermijding.']::text[],array['Angst begrijpen','Piekergedachten','Onzekerheid','Controlebehoefte','Vermijdingsgedrag']::text[]) on conflict(product_id) do nothing;
end $$;
do $$declare product uuid;begin
insert into public.products(title,slug,type,status,summary,price_cents,currency) values('Het Evenwicht','het-evenwicht','module','published','Je verdiept je in de werking van je zenuwstelsel en leert spanning en ontregeling herkennen. Met gerichte oefeningen ontdek je manieren om je lichaam te ondersteunen bij het vinden van meer evenwicht.',8900,'EUR') on conflict(slug) do nothing;
select id into product from public.products where slug='het-evenwicht' and type='module'; if product is null then raise exception 'module_slug_conflict';end if;
insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order) values(product,'Online module','','','','upcoming','Het water hoeft niet altijd stil te zijn. Soms zijn er golven, soms is er nauwelijks beweging. Het gaat erom te ontdekken wat jou helpt wanneer je uit evenwicht raakt.

Je verdiept je in de werking van je zenuwstelsel en leert spanning en ontregeling herkennen. Met gerichte oefeningen ontdek je manieren om je lichaam te ondersteunen bij het vinden van meer evenwicht.','PDF met uitleg en oefeningen, met bijbehorende audio.','Na bevestiging van je betaling open je de module in je bibliotheek.','Doelgroep, toegangsduur en ondersteuning nog in te vullen; materiaal nog aan te leveren.','/images/editorial/mygrowise-74.jpg',204) on conflict(product_id) do nothing;
insert into public.module_details(product_id,number,subtitle,tagline,introduction,topics) values(product,4,'Begrijp je zenuwstelsel en leer reguleren','Leren bewegen met het water',array['Het water hoeft niet altijd stil te zijn. Soms zijn er golven, soms is er nauwelijks beweging. Het gaat erom te ontdekken wat jou helpt wanneer je uit evenwicht raakt.','Je verdiept je in de werking van je zenuwstelsel en leert spanning en ontregeling herkennen. Met gerichte oefeningen ontdek je manieren om je lichaam te ondersteunen bij het vinden van meer evenwicht.']::text[],array['Window of Tolerance','Hyperarousal','Hypoarousal','Ademhaling','Hartcoherentie','Regulatie']::text[]) on conflict(product_id) do nothing;
end $$;
do $$declare product uuid;begin
insert into public.products(title,slug,type,status,summary,price_cents,currency) values('De Bergen','de-bergen','module','published','Je ontdekt hoe persoonlijkheid, aanleg, opvoeding en levenservaringen mee vormgeven aan hoe je denkt, voelt en reageert. Je verkent overtuigingen, beschermingsmechanismen, grenzen en zelfzorg: wat helpt jou vandaag nog en wat mag anders?',8900,'EUR') on conflict(slug) do nothing;
select id into product from public.products where slug='de-bergen' and type='module'; if product is null then raise exception 'module_slug_conflict';end if;
insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order) values(product,'Online module','','','','upcoming','Rondom het meer rijzen bergen op. Sommige hellingen zijn zacht, andere steil. Er zijn vertrouwde paden en routes die je nog nooit hebt verkend.

Je ontdekt hoe persoonlijkheid, aanleg, opvoeding en levenservaringen mee vormgeven aan hoe je denkt, voelt en reageert. Je verkent overtuigingen, beschermingsmechanismen, grenzen en zelfzorg: wat helpt jou vandaag nog en wat mag anders?','PDF met uitleg en oefeningen, met bijbehorende audio.','Na bevestiging van je betaling open je de module in je bibliotheek.','Doelgroep, toegangsduur en ondersteuning nog in te vullen; materiaal nog aan te leveren.','/images/editorial/mygrowise-74.jpg',205) on conflict(product_id) do nothing;
insert into public.module_details(product_id,number,subtitle,tagline,introduction,topics) values(product,5,'Persoonlijkheid, beschermingsmechanismen en zelfzorg','Ontdek hoe jouw landschap gevormd werd',array['Rondom het meer rijzen bergen op. Sommige hellingen zijn zacht, andere steil. Er zijn vertrouwde paden en routes die je nog nooit hebt verkend.','Je ontdekt hoe persoonlijkheid, aanleg, opvoeding en levenservaringen mee vormgeven aan hoe je denkt, voelt en reageert. Je verkent overtuigingen, beschermingsmechanismen, grenzen en zelfzorg: wat helpt jou vandaag nog en wat mag anders?']::text[],array['Persoonlijkheid','Nature en nurture','Overtuigingen','Beschermingsmechanismen','Grenzen','Zelfzorg']::text[]) on conflict(product_id) do nothing;
end $$;
do $$declare product uuid;begin
insert into public.products(title,slug,type,status,summary,price_cents,currency) values('Het Volledige Landschap','het-volledige-landschap','module','published','Je brengt jouw inzichten samen, ontdekt hoe je ze in het dagelijks leven kunt toepassen en geeft vorm aan je persoonlijke innerlijke landschap: je patronen, krachten, kwetsbaarheden en mogelijkheden.',8900,'EUR') on conflict(slug) do nothing;
select id into product from public.products where slug='het-volledige-landschap' and type='module'; if product is null then raise exception 'module_slug_conflict';end if;
insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order) values(product,'Online module','','','','upcoming','Je staat opnieuw aan het meer. De bergen zijn er nog, net als de stromingen en de mist. Maar je kijkt met andere ogen.

Je brengt jouw inzichten samen, ontdekt hoe je ze in het dagelijks leven kunt toepassen en geeft vorm aan je persoonlijke innerlijke landschap: je patronen, krachten, kwetsbaarheden en mogelijkheden.','PDF met uitleg en oefeningen, met bijbehorende audio.','Na bevestiging van je betaling open je de module in je bibliotheek.','Doelgroep, toegangsduur en ondersteuning nog in te vullen; materiaal nog aan te leveren.','/images/editorial/mygrowise-74.jpg',206) on conflict(product_id) do nothing;
insert into public.module_details(product_id,number,subtitle,tagline,introduction,topics) values(product,6,'Integreren en vooruitkijken','Alles krijgt een plaats',array['Je staat opnieuw aan het meer. De bergen zijn er nog, net als de stromingen en de mist. Maar je kijkt met andere ogen.','Je brengt jouw inzichten samen, ontdekt hoe je ze in het dagelijks leven kunt toepassen en geeft vorm aan je persoonlijke innerlijke landschap: je patronen, krachten, kwetsbaarheden en mogelijkheden.']::text[],array['Zelfinzicht','Persoonlijke patronen','Hulpbronnen','Integratie','Toepassing in het dagelijks leven']::text[]) on conflict(product_id) do nothing;
end $$;
notify pgrst, 'reload schema';

-- A published module retains its identity, and previous releases can be restored.
create function public.guard_module_type() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.type='module' and new.type<>'module' and exists(select 1 from public.module_details where product_id=old.id) then raise exception 'module_type_locked';end if;
 return new;
end $$;
create trigger module_type_locked before update of type on public.products for each row execute function public.guard_module_type();
create function public.restore_module_release(p_actor uuid,p_id uuid,p_release uuid,p_revision integer) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(104041511);
 perform 1 from public.module_details where product_id=p_id and revision=p_revision for update;
 if not found then raise exception 'revision_conflict';end if;
 if not exists(select 1 from public.module_releases where id=p_release and product_id=p_id and status='published') then raise exception 'invalid_module';end if;
 update public.module_details set current_release_id=p_release,revision=revision+1 where product_id=p_id;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,metadata) values(p_actor,'module.material_restored','product',p_id::text,jsonb_build_object('release',p_release));
end $$;
revoke all on function public.guard_module_type(),public.restore_module_release(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.guard_module_type(),public.restore_module_release(uuid,uuid,uuid,integer) to service_role;
