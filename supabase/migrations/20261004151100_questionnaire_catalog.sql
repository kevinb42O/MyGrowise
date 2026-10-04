-- Public catalog data and strictly private publisher costs are separate.
create table public.catalog_details (
 product_id uuid primary key references public.products(id) on delete cascade,
 category text not null default '', audience text not null default '',
 age_label text not null default '', version text not null default '',
 availability text not null default 'available' check (availability in ('available','upcoming','paused')),
 description text not null default '', includes_text text not null default '',
 delivery_text text not null default 'Na bevestiging van je betaling neemt MyGrowise contact met je op voor de afname.',
 review_note text not null default '', image text not null default '/images/editorial/mygrowise-50.jpg',
 sort_order integer not null default 100,
 updated_at timestamptz not null default now()
);
create table public.catalog_costs (
 product_id uuid primary key references public.products(id) on delete cascade,
 publisher_cost_cents integer check (publisher_cost_cents between 0 and 10000000),
 cost_note text not null default '', updated_at timestamptz not null default now()
);
create table public.catalog_components (
 id uuid primary key default gen_random_uuid(),
 package_id uuid not null references public.products(id) on delete cascade,
 questionnaire_id uuid references public.products(id) on delete restrict,
 label text not null check (char_length(label) between 1 and 160),
 sort_order integer not null default 0,
 check (package_id is distinct from questionnaire_id),
 unique(package_id,questionnaire_id)
);
create table public.catalog_pricing (
 id boolean primary key default true check (id),
 medium_min integer not null default 2 check (medium_min between 2 and 30),
 medium_percent integer not null default 5 check (medium_percent between 0 and 100),
 large_min integer not null default 4 check (large_min between 3 and 30),
 large_percent integer not null default 10 check (large_percent between 0 and 100),
 price_label text not null default 'Eenmalige prijs',
 updated_at timestamptz not null default now(),
 check (large_min > medium_min and large_percent >= medium_percent)
);
insert into public.catalog_pricing(id) values(true);
alter table public.orders add column catalog_quote jsonb;
alter table public.orders add column submission_key uuid;
create unique index catalog_order_submission on public.orders(customer_user_id,submission_key) where submission_key is not null;
alter table public.order_items add column catalog_snapshot jsonb;
alter table public.order_items add column list_price_cents integer;
create table public.assessment_deliveries (
 id uuid primary key default gen_random_uuid(),
 order_item_id uuid not null references public.order_items(id) on delete cascade,
 customer_user_id uuid not null references public.profiles(id) on delete restrict,
 component_key text not null, title text not null,
 status text not null default 'pending' check(status in ('pending','invited','received','completed')),
 instructions text not null default '', external_url text not null default '', report_path text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(order_item_id,component_key)
);
create index assessment_deliveries_customer on public.assessment_deliveries(customer_user_id,created_at desc);
-- Server-only access: public endpoints select a safe subset explicitly.
alter table public.catalog_details enable row level security;
alter table public.catalog_costs enable row level security;
alter table public.catalog_components enable row level security;
alter table public.catalog_pricing enable row level security;
alter table public.assessment_deliveries enable row level security;
revoke all on public.catalog_details,public.catalog_costs,public.catalog_components,public.catalog_pricing,public.assessment_deliveries from anon,authenticated;
grant all on public.catalog_details,public.catalog_costs,public.catalog_components,public.catalog_pricing,public.assessment_deliveries to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('assessment-reports','assessment-reports',false,15728640,array['application/pdf']) on conflict(id) do nothing;

create function public.catalog_quote(p_ids uuid[], p_mode text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_settings public.catalog_pricing%rowtype; v_row record; v_items jsonb:='[]'; v_item jsonb; v_sub integer:=0; v_pct integer:=0; v_total integer; v_quote jsonb; v_count integer;
begin
 perform pg_advisory_xact_lock(104041511);
 select * into v_settings from public.catalog_pricing where id=true;
 v_count:=cardinality(p_ids);
 if p_mode not in ('package','custom') or v_count is null or v_count<1 or v_count>30 or v_count<>(select count(distinct x) from unnest(p_ids) x) or (p_mode='package' and v_count<>1) then raise exception 'invalid_selection'; end if;
 for v_row in select p.*,d.availability,d.delivery_text,d.updated_at as detail_updated from public.products p join public.catalog_details d on d.product_id=p.id where p.id=any(p_ids) order by p.id loop
  if v_row.status<>'published' or v_row.availability<>'available' or v_row.price_cents is null or v_row.currency<>'EUR' or (p_mode='custom' and v_row.type<>'questionnaire') or (p_mode='package' and v_row.type<>'profile') then raise exception 'unavailable_product'; end if;
  v_item:=jsonb_build_object('id',v_row.id,'slug',v_row.slug,'title',v_row.title,'type',v_row.type,'listPriceCents',v_row.price_cents,'deliveryText',v_row.delivery_text,'revision',v_row.updated_at::text||v_row.detail_updated::text,'components',coalesce((select jsonb_agg(jsonb_build_object('key',c.id,'id',c.questionnaire_id,'title',c.label) order by c.sort_order,c.id) from public.catalog_components c where c.package_id=v_row.id),'[]'::jsonb));
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
revoke all on function public.catalog_quote(uuid[],text) from public;
grant execute on function public.catalog_quote(uuid[],text) to service_role;

create function public.create_catalog_order(p_customer_id uuid,p_ids uuid[],p_mode text,p_hash text,p_submission uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_quote jsonb; v_id uuid; v_item jsonb; v_existing public.orders%rowtype;
begin
 perform pg_advisory_xact_lock(104041511);
 if p_submission is null or not exists(select 1 from public.user_roles where user_id=p_customer_id and role='customer') or exists(select 1 from public.user_roles where user_id=p_customer_id and role<>'customer') then raise exception 'invalid_customer'; end if;
 select * into v_existing from public.orders where customer_user_id=p_customer_id and submission_key=p_submission;
 if found then
  if v_existing.catalog_quote->>'hash' is distinct from p_hash then raise exception 'submission_conflict'; end if;
  return v_existing.id;
 end if;
 v_quote:=public.catalog_quote(p_ids,p_mode);
 if v_quote->>'hash' is distinct from p_hash then raise exception 'quote_changed'; end if;
 insert into public.orders(customer_user_id,status,total_cents,currency,provider,provider_reference,catalog_quote,submission_key) values(p_customer_id,'pending_payment',(v_quote->>'totalCents')::integer,'EUR','wise_manual','MG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),v_quote,p_submission) returning id into v_id;
 for v_item in select value from jsonb_array_elements(v_quote->'items') loop
  insert into public.order_items(order_id,product_id,product_title,product_slug,product_type,price_cents,list_price_cents,catalog_snapshot) values(v_id,(v_item->>'id')::uuid,v_item->>'title',v_item->>'slug',(v_item->>'type')::public.product_type,(v_item->>'priceCents')::integer,(v_item->>'listPriceCents')::integer,v_item);
 end loop;
 return v_id;
end $$;
revoke all on function public.create_catalog_order(uuid,uuid[],text,text,uuid) from public;
grant execute on function public.create_catalog_order(uuid,uuid[],text,text,uuid) to service_role;

create function public.create_paid_assessment_deliveries() returns trigger language plpgsql security definer set search_path='' as $$
declare v_item record; v_components jsonb; v_component jsonb;
begin
 if new.status in ('paid','fulfilled') and old.status not in ('paid','fulfilled') then
  for v_item in select * from public.order_items where order_id=new.id and product_type in ('questionnaire','profile') loop
   v_components:=v_item.catalog_snapshot->'components';
   -- Legacy orders have no snapshot: deliver the purchased profile as a whole.
   if v_components is null or jsonb_array_length(v_components)=0 then v_components:=jsonb_build_array(jsonb_build_object('key',v_item.product_slug,'title',v_item.product_title)); end if;
   for v_component in select value from jsonb_array_elements(v_components) loop
    insert into public.assessment_deliveries(order_item_id,customer_user_id,component_key,title,instructions) values(v_item.id,new.customer_user_id,v_component->>'key',v_component->>'title',coalesce(v_item.catalog_snapshot->>'deliveryText','MyGrowise neemt contact met je op voor de afname.')) on conflict do nothing;
   end loop;
  end loop;
 end if;
 return new;
end $$;
create trigger order_paid_assessment_deliveries after update of status on public.orders for each row execute function public.create_paid_assessment_deliveries();

create function public.save_catalog_product(p_actor uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_component jsonb; v_type public.product_type;
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(104041511);
 v_id:=nullif(p_data->>'id','')::uuid; v_type:=(p_data->>'type')::public.product_type;
 if v_type not in ('profile','questionnaire') then raise exception 'invalid_type'; end if;
 if v_id is null then
  insert into public.products(title,slug,type,status,summary,price_cents,currency,updated_by) values(p_data->>'title',p_data->>'slug',v_type,(p_data->>'status')::public.product_status,p_data->>'summary',nullif(p_data->>'priceCents','')::integer,'EUR',p_actor) returning id into v_id;
 else
  update public.products set title=p_data->>'title',slug=p_data->>'slug',type=v_type,status=(p_data->>'status')::public.product_status,summary=p_data->>'summary',price_cents=nullif(p_data->>'priceCents','')::integer,updated_by=p_actor,updated_at=now() where id=v_id;
  if not found then raise exception 'not_found'; end if;
 end if;
 insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order) values(v_id,p_data->>'category',p_data->>'audience',p_data->>'ageLabel',p_data->>'version',p_data->>'availability',p_data->>'description',p_data->>'includesText',p_data->>'deliveryText',p_data->>'reviewNote',p_data->>'image',(p_data->>'sortOrder')::integer)
 on conflict(product_id) do update set category=excluded.category,audience=excluded.audience,age_label=excluded.age_label,version=excluded.version,availability=excluded.availability,description=excluded.description,includes_text=excluded.includes_text,delivery_text=excluded.delivery_text,review_note=excluded.review_note,image=excluded.image,sort_order=excluded.sort_order,updated_at=now();
 insert into public.catalog_costs(product_id,publisher_cost_cents,cost_note) values(v_id,nullif(p_data->>'costCents','')::integer,p_data->>'costNote') on conflict(product_id) do update set publisher_cost_cents=excluded.publisher_cost_cents,cost_note=excluded.cost_note,updated_at=now();
 delete from public.catalog_components where package_id=v_id;
 if v_type='profile' then
  for v_component in select value from jsonb_array_elements(p_data->'components') loop
   if nullif(v_component->>'id','') is not null and not exists(select 1 from public.products where id=(v_component->>'id')::uuid and type='questionnaire') then raise exception 'invalid_component'; end if;
   insert into public.catalog_components(package_id,questionnaire_id,label,sort_order) values(v_id,nullif(v_component->>'id','')::uuid,v_component->>'title',(v_component->>'sortOrder')::integer);
  end loop;
  if p_data->>'status'='published' and p_data->>'availability'='available' and not exists(select 1 from public.catalog_components where package_id=v_id) then raise exception 'empty_package'; end if;
 end if;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,metadata) values(p_actor,'catalog.product_saved','product',v_id::text,jsonb_build_object('type',v_type,'status',p_data->>'status','availability',p_data->>'availability'));
 return v_id;
end $$;
revoke all on function public.save_catalog_product(uuid,jsonb) from public;
grant execute on function public.save_catalog_product(uuid,jsonb) to service_role;

create function public.save_catalog_pricing(p_actor uuid,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(104041511);
 update public.catalog_pricing set medium_min=(p_data->>'mediumMin')::integer,medium_percent=(p_data->>'mediumPercent')::integer,large_min=(p_data->>'largeMin')::integer,large_percent=(p_data->>'largePercent')::integer,price_label=p_data->>'priceLabel',updated_at=now() where id=true;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,metadata) values(p_actor,'catalog.pricing_saved','catalog','pricing',p_data);
end $$;
revoke all on function public.save_catalog_pricing(uuid,jsonb) from public;
grant execute on function public.save_catalog_pricing(uuid,jsonb) to service_role;

create function public.update_assessment_delivery(p_actor uuid,p_id uuid,p_status text,p_instructions text,p_url text,p_report text) returns void language plpgsql security definer set search_path='' as $$
declare v_old text;
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden'; end if;
 select status into v_old from public.assessment_deliveries where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 update public.assessment_deliveries set status=p_status,instructions=p_instructions,external_url=p_url,report_path=coalesce(p_report,report_path),updated_at=now() where id=p_id;
 insert into public.security_audit_log(actor_user_id,action,object_type,object_id,metadata) values(p_actor,'assessment.delivery_updated','assessment_delivery',p_id::text,jsonb_build_object('before_status',v_old,'after_status',p_status,'report_uploaded',p_report is not null));
end $$;
revoke all on function public.update_assessment_delivery(uuid,uuid,text,text,text,text) from public;
grant execute on function public.update_assessment_delivery(uuid,uuid,text,text,text,text) to service_role;

-- Existing purchase links use the same authoritative catalog and snapshots.
alter function public.create_wise_manual_order(uuid,text) rename to create_legacy_wise_manual_order;
create function public.create_wise_manual_order(p_customer_id uuid,p_product_slug text) returns table(order_id uuid,payment_reference text)
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_type text; v_quote jsonb; v_order uuid;
begin
 select p.id,p.type::text into v_id,v_type from public.products p join public.catalog_details d on d.product_id=p.id where p.slug=lower(trim(p_product_slug));
 if v_id is null then return query select * from public.create_legacy_wise_manual_order(p_customer_id,p_product_slug); return; end if;
 v_quote:=public.catalog_quote(array[v_id],case when v_type='profile' then 'package' else 'custom' end);
 select id into v_order from public.orders where customer_user_id=p_customer_id and status='pending_payment' and catalog_quote->>'hash'=v_quote->>'hash' order by created_at desc limit 1;
 if v_order is null then v_order:=public.create_catalog_order(p_customer_id,array[v_id],v_quote->>'mode',v_quote->>'hash',gen_random_uuid()); end if;
 return query select id,provider_reference from public.orders where id=v_order;
end $$;
revoke all on function public.create_wise_manual_order(uuid,text) from public;
grant execute on function public.create_wise_manual_order(uuid,text) to service_role;
