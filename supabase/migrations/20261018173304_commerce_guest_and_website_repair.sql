-- Purchase ownership exists independently of an Auth account. Existing account
-- functions keep working through the ownership triggers below.
create table public.commerce_buyers (
 id uuid primary key default gen_random_uuid(), customer_user_id uuid unique references public.profiles(id),
 email text not null check(length(email)<=254 and email=lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 first_name text not null default '' check(length(first_name)<=60), last_name text not null default '' check(length(last_name)<=60),
 birth_date date, gender text not null default '' check(gender in ('','male','female','other','unspecified')),
 created_at timestamptz not null default now()
);
create index commerce_buyers_email on public.commerce_buyers(email);
insert into public.commerce_buyers(customer_user_id,email,first_name)
 select p.id,lower(u.email),left(coalesce(p.full_name,''),60) from public.profiles p join auth.users u on u.id=p.id
 where exists(select 1 from public.orders o where o.customer_user_id=p.id) or exists(select 1 from public.entitlements e where e.customer_user_id=p.id);
alter table public.orders add column buyer_id uuid references public.commerce_buyers(id), add column contact_snapshot jsonb not null default '{}', add column checkout_hash text;
alter table public.entitlements add column buyer_id uuid references public.commerce_buyers(id);
alter table public.assessment_deliveries add column buyer_id uuid references public.commerce_buyers(id);
update public.orders o set buyer_id=b.id from public.commerce_buyers b where b.customer_user_id=o.customer_user_id;
update public.entitlements e set buyer_id=b.id from public.commerce_buyers b where b.customer_user_id=e.customer_user_id;
update public.assessment_deliveries a set buyer_id=b.id from public.commerce_buyers b where b.customer_user_id=a.customer_user_id;
alter table public.orders alter column customer_user_id drop not null, alter column buyer_id set not null;
alter table public.entitlements alter column customer_user_id drop not null, alter column buyer_id set not null;
alter table public.assessment_deliveries alter column customer_user_id drop not null, alter column buyer_id set not null;
create index orders_buyer on public.orders(buyer_id,created_at desc);
create unique index guest_order_submission on public.orders(checkout_hash,submission_key) where checkout_hash is not null;
create unique index buyer_active_product on public.entitlements(buyer_id,product_id) where status='active' and product_id is not null;

create schema if not exists commerce_private;
revoke all on schema commerce_private from public,anon,authenticated;
grant usage on schema commerce_private to service_role;
create function commerce_private.account_email(p_user uuid) returns text language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is not null and auth.uid()<>p_user then raise exception 'forbidden';end if;
 return (select lower(email) from auth.users where id=p_user and email_confirmed_at is not null);
end $$;
revoke all on function commerce_private.account_email(uuid) from public,anon,authenticated;
grant execute on function commerce_private.account_email(uuid) to service_role;

create function public.set_purchase_buyer() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_email text; v_buyer uuid; v_customer uuid;begin
 if tg_table_name='orders' then
  if new.buyer_id is null and new.customer_user_id is not null then
   v_email:=commerce_private.account_email(new.customer_user_id);
   if v_email is null then raise exception 'email_confirmation';end if;
   insert into public.commerce_buyers(customer_user_id,email) values(new.customer_user_id,v_email) on conflict(customer_user_id) do nothing;
   select id into new.buyer_id from public.commerce_buyers where customer_user_id=new.customer_user_id;
  end if;
  select customer_user_id into v_customer from public.commerce_buyers where id=new.buyer_id;
  if not found or v_customer is distinct from new.customer_user_id then raise exception 'buyer_mismatch';end if;
 else
  if new.order_item_id is not null then
   select o.buyer_id,o.customer_user_id into v_buyer,v_customer from public.orders o join public.order_items i on i.order_id=o.id where i.id=new.order_item_id;
   if not found then raise exception 'order_missing';end if;
   new.buyer_id:=v_buyer;new.customer_user_id:=v_customer;
  elsif new.buyer_id is null and new.customer_user_id is not null then
   insert into public.commerce_buyers(customer_user_id,email) values(new.customer_user_id,commerce_private.account_email(new.customer_user_id)) on conflict(customer_user_id) do nothing;
   select id into new.buyer_id from public.commerce_buyers where customer_user_id=new.customer_user_id;
  end if;
 end if;
 return new;
end $$;
create trigger purchase_order_buyer before insert on public.orders for each row execute function public.set_purchase_buyer();
create trigger purchase_right_buyer before insert on public.entitlements for each row execute function public.set_purchase_buyer();
create trigger purchase_delivery_buyer before insert on public.assessment_deliveries for each row execute function public.set_purchase_buyer();

create table public.commerce_access_tokens (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), email text not null, expires_at timestamptz not null, consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.commerce_sessions (
 session_hash text primary key check(session_hash ~ '^[a-f0-9]{64}$'), email text not null, expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create function public.consume_purchase_token(p_token text,p_session text) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_email text;begin
 update public.commerce_access_tokens set consumed_at=now() where token_hash=p_token and consumed_at is null and expires_at>now() returning email into v_email;
 if v_email is null then return false;end if;
 insert into public.commerce_sessions(session_hash,email,expires_at) values(p_session,v_email,now()+interval '7 days');
 return true;
end $$;

create function public.create_guest_catalog_order(p_checkout text,p_ids uuid[],p_mode text,p_hash text,p_submission uuid,p_contact jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare q jsonb; existing public.orders%rowtype; buyer uuid; result uuid; item jsonb;begin
 perform pg_advisory_xact_lock(104041511);
 if p_checkout !~ '^[a-f0-9]{64}$' or p_submission is null then raise exception 'invalid_submission';end if;
 if length(coalesce(p_contact->>'email','')) not between 3 and 254 or p_contact->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or length(btrim(coalesce(p_contact->>'first_name',''))) not between 1 and 60 or length(btrim(coalesce(p_contact->>'last_name',''))) not between 1 and 60
 or coalesce(p_contact->>'gender','') not in ('male','female','other','unspecified') or coalesce(p_contact->>'birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or (p_contact->>'birth_date')::date>current_date then raise exception 'invalid_contact';end if;
 select * into existing from public.orders where checkout_hash=p_checkout and submission_key=p_submission;
 if found then
  if existing.catalog_quote->>'hash' is distinct from p_hash or existing.contact_snapshot<>p_contact then raise exception 'submission_conflict';end if;
  return existing.id;
 end if;
 q:=public.catalog_quote(p_ids,p_mode);
 if q->>'hash' is distinct from p_hash then raise exception 'quote_changed';end if;
 insert into public.commerce_buyers(email,first_name,last_name,birth_date,gender) values(lower(btrim(p_contact->>'email')),p_contact->>'first_name',p_contact->>'last_name',(p_contact->>'birth_date')::date,p_contact->>'gender') returning id into buyer;
 insert into public.orders(buyer_id,contact_snapshot,checkout_hash,status,total_cents,currency,provider,provider_reference,catalog_quote,submission_key)
 values(buyer,p_contact,p_checkout,'pending_payment',(q->>'totalCents')::int,'EUR','wise_manual','MG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),q,p_submission) returning id into result;
 for item in select value from jsonb_array_elements(q->'items') loop
  insert into public.order_items(order_id,product_id,product_title,product_slug,product_type,price_cents,list_price_cents,catalog_snapshot)
  values(result,(item->>'id')::uuid,item->>'title',item->>'slug',(item->>'type')::public.product_type,(item->>'priceCents')::int,(item->>'listPriceCents')::int,item);
 end loop;
 return result;
end $$;

create function public.link_guest_purchases(p_user uuid,p_session text) returns void language plpgsql security invoker set search_path='' as $$
declare v_email text; v_account uuid; v_guest record;begin
 v_email:=commerce_private.account_email(p_user);
 if v_email is null or not exists(select 1 from public.user_roles where user_id=p_user and role='customer') or exists(select 1 from public.user_roles where user_id=p_user and role<>'customer')
 or not exists(select 1 from public.commerce_sessions where session_hash=p_session and email=v_email and expires_at>now()) then raise exception 'forbidden';end if;
 perform pg_advisory_xact_lock(104041511);
 insert into public.commerce_buyers(customer_user_id,email) values(p_user,v_email) on conflict(customer_user_id) do nothing;
 select id into v_account from public.commerce_buyers where customer_user_id=p_user;
 for v_guest in select id from public.commerce_buyers where email=v_email and customer_user_id is null for update loop
  -- An already owned module needs only one active right. Preserve its historic row.
  update public.entitlements e set status='revoked',revoked_at=now() where buyer_id=v_guest.id and status='active' and exists(select 1 from public.entitlements a where a.buyer_id=v_account and a.product_id=e.product_id and a.status='active');
  update public.orders set buyer_id=v_account,customer_user_id=p_user where buyer_id=v_guest.id;
  update public.entitlements set buyer_id=v_account,customer_user_id=p_user where buyer_id=v_guest.id;
  update public.assessment_deliveries set buyer_id=v_account,customer_user_id=p_user where buyer_id=v_guest.id;
 end loop;
end $$;

-- A separate durable outbox handles plain contact mail and purchase access.
create table public.website_mail_jobs (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('contact','purchase_access')),
 payload jsonb not null, submission_key uuid unique, status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), lease_until timestamptz, lease_token uuid,
 sent_at timestamptz, created_at timestamptz not null default now()
);
create function public.claim_website_mail(p_limit integer) returns setof public.website_mail_jobs language sql security invoker set search_path='' as $$
 update public.website_mail_jobs set status='sending',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
 where id in(select id from public.website_mail_jobs where (status='pending' or(status='sending' and lease_until<now())) and attempts<6 and next_attempt_at<=now() order by created_at limit least(greatest(p_limit,1),20) for update skip locked) returning *;
$$;

-- Recommendations point at real products, never arbitrary checkout URLs.
create table public.module_recommendations (
 module_product_id uuid not null references public.module_details(product_id), target_product_id uuid not null references public.products(id),
 sort_order integer not null default 0 check(sort_order between 0 and 999), visible boolean not null default true,
 primary key(module_product_id,target_product_id), check(module_product_id<>target_product_id)
);
create function public.save_module_recommendations(p_actor uuid,p_id uuid,p_revision integer,p_targets uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 perform 1 from public.module_details where product_id=p_id and revision=p_revision for update;
 if not found then raise exception 'revision_conflict';end if;
 if cardinality(p_targets)>30 or cardinality(p_targets)<>(select count(distinct id) from unnest(p_targets) id) or exists(select 1 from unnest(p_targets) id where not exists(select 1 from public.products p where p.id=id and p.type in ('questionnaire','profile','guide'))) then raise exception 'invalid_recommendation';end if;
 delete from public.module_recommendations where module_product_id=p_id;
 insert into public.module_recommendations(module_product_id,target_product_id,sort_order) select p_id,id,n from unnest(p_targets) with ordinality x(id,n);
 update public.module_details set revision=revision+1 where product_id=p_id;
end $$;

-- The existing material/version engine also serves supplementary guides.
alter table public.module_details add column format text not null default 'module' check(format in ('module','pdf','audio'));
alter table public.module_details drop constraint module_details_number_check;
alter table public.module_details add constraint module_details_number_check check((format='module' and number between 1 and 6) or(format in ('pdf','audio') and number=0));
do $$declare definition text;begin
 select pg_get_functiondef('public.publish_module_release(uuid,uuid,integer,boolean)'::regprocedure) into definition;
 definition:=replace(definition,$patch$not exists(select 1 from public.module_assets where release_id=r.id and kind='pdf' and status='verified')$patch$, $patch$((select format from public.module_details where product_id=r.product_id) in ('module','pdf') and not exists(select 1 from public.module_assets where release_id=r.id and kind='pdf' and status='verified'))$patch$);
 definition:=replace(definition,$patch$not exists(select 1 from public.module_assets where release_id=r.id and kind='audio' and status='verified')$patch$, $patch$((select format from public.module_details where product_id=r.product_id) in ('module','audio') and not exists(select 1 from public.module_assets where release_id=r.id and kind='audio' and status='verified'))$patch$);
 execute definition;
 select pg_get_functiondef('public.save_module(uuid,uuid,integer,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$patch$type='module'$patch$,$patch$type in ('module','guide')$patch$);
 definition:=replace(definition,$patch$v_catalog->>'type' is distinct from 'module'$patch$,$patch$v_catalog->>'type' is distinct from (select type::text from public.products where id=p_id)$patch$);
 execute definition;
 select pg_get_functiondef('public.catalog_quote(uuid[],text)'::regprocedure) into definition;
 definition:=replace(definition,$patch$('questionnaire','module')$patch$,$patch$('questionnaire','module','guide')$patch$);
 definition:=replace(definition,$patch$v_row.type='module'$patch$,$patch$v_row.type in ('module','guide')$patch$);
 execute definition;
end $$;

create function public.new_supplement(p_actor uuid,p_title text,p_slug text,p_format text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;begin
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='super_admin') then raise exception 'forbidden';end if;
 if p_format not in ('pdf','audio') or length(btrim(p_title)) not between 3 and 120 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>80 then raise exception 'invalid_supplement';end if;
 insert into public.products(title,slug,type,status,summary,price_cents,currency) values(p_title,p_slug,'guide','draft','Beschrijving van deze optionele verdieping nog aan te vullen.',null,'EUR') returning id into result;
 insert into public.catalog_details(product_id,availability,sort_order) values(result,'upcoming',300);
 insert into public.module_details(product_id,series,number,format) values(result,'supplement-'||result::text,0,p_format);
 return result;
end $$;

-- All new data and RPCs are server-only. Guest requests are authorized in Astro.
do $$declare t text;begin
 foreach t in array array['commerce_buyers','commerce_access_tokens','commerce_sessions','website_mail_jobs','module_recommendations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.set_purchase_buyer(),public.consume_purchase_token(text,text),public.create_guest_catalog_order(text,uuid[],text,text,uuid,jsonb),public.link_guest_purchases(uuid,text),public.claim_website_mail(integer),public.save_module_recommendations(uuid,uuid,integer,uuid[]),public.new_supplement(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.set_purchase_buyer(),public.consume_purchase_token(text,text),public.create_guest_catalog_order(text,uuid[],text,text,uuid,jsonb),public.link_guest_purchases(uuid,text),public.claim_website_mail(integer),public.save_module_recommendations(uuid,uuid,integer,uuid[]),public.new_supplement(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';

-- Single-file supplements use the same checked material and sale boundary.
create or replace function public.module_ready(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.module_details d join public.module_releases r on r.id=d.current_release_id and r.product_id=d.product_id
 where d.product_id=p_id and r.status='published' and btrim(d.audience_text)<>'' and btrim(d.access_text)<>'' and btrim(d.support_text)<>''
 and (d.format='audio' or exists(select 1 from public.module_assets a where a.release_id=r.id and a.kind='pdf' and a.status='verified'))
 and (d.format='pdf' or exists(select 1 from public.module_assets a where a.release_id=r.id and a.kind='audio' and a.status='verified'))
 and not exists(select 1 from public.module_assets a where a.release_id=r.id and a.status<>'verified'));
$$;
do $$declare definition text;begin
 select pg_get_functiondef('public.save_catalog_product(uuid,jsonb)'::regprocedure) into definition;
 execute replace(definition, $p$('profile','questionnaire','module')$p$, $p$('profile','questionnaire','module','guide')$p$);
 select pg_get_functiondef('public.guard_module_sale()'::regprocedure) into definition;
 execute replace(definition,$p$type='module'$p$,$p$type in ('module','guide')$p$);
 select pg_get_functiondef('public.get_offer_slots(uuid,integer)'::regprocedure) into definition;
 if position($p$where c.starts_at>=now()+make_interval(hours=>p.minimum_notice_hours)$p$ in definition)=0 then raise exception 'offer_slots_version_mismatch';end if;
 execute replace(definition,$p$where c.starts_at>=now()+make_interval(hours=>p.minimum_notice_hours)$p$,$p$where timezone('Europe/Brussels',c.starts_at)::date>timezone('Europe/Brussels',now())::date and c.starts_at>=now()+make_interval(hours=>p.minimum_notice_hours)$p$);
end $$;
notify pgrst,'reload schema';

create index deliveries_buyer on public.assessment_deliveries(buyer_id,created_at desc);
create index recommendation_target on public.module_recommendations(target_product_id);
create index website_mail_due on public.website_mail_jobs(next_attempt_at) where status in ('pending','sending');
create index purchase_token_expiry on public.commerce_access_tokens(expires_at);
create index purchase_session_expiry on public.commerce_sessions(expires_at);
create or replace function public.guard_module_type() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.type in ('module','guide') and new.type<>old.type and exists(select 1 from public.module_details where product_id=old.id) then raise exception 'module_type_locked';end if;
 return new;
end $$;
-- The older calendar preview must enforce the same Brussels calendar-day boundary.
do $$declare definition text;begin
 select pg_get_functiondef('public.get_bookable_slots(text,integer)'::regprocedure) into definition;
 if position('where candidate.starts_at >= now()' in definition)=0 then raise exception 'bookable_slots_version_mismatch';end if;
 execute replace(definition,'where candidate.starts_at >= now()','where timezone(''Europe/Brussels'',candidate.starts_at)::date>timezone(''Europe/Brussels'',now())::date and candidate.starts_at >= now()');
 select pg_get_functiondef('public.create_catalog_order(uuid,uuid[],text,text,uuid)'::regprocedure) into definition;
 execute replace(replace(definition,$p$product_type='module'$p$,$p$product_type in ('module','guide')$p$),$p$i.product_type='module'$p$,$p$i.product_type in ('module','guide')$p$);
end $$;

-- Age ranges and variants come from the supplied profile brief. Existing paid
-- snapshots and deliveries are immutable; only new orders select a variant.
update public.catalog_details set age_label='8–17 jaar' where product_id=(select id from public.products where slug='emotioneel-welzijnsprofiel-jongeren');
update public.catalog_details set age_label='Vanaf 8 jaar',audience='Kinderen, jongeren en volwassenen',includes_text='Twee vragenlijsten per leeftijdsversie: SPM-2 met FEEL-KJ (8–17 jaar) of FEEL-E (18+).'
 where product_id=(select id from public.products where slug='prikkelverwerkingsprofiel');
update public.catalog_components set questionnaire_id=null,label='FEEL-KJ (8–17 jaar) of FEEL-E (18+)' where package_id=(select id from public.products where slug='prikkelverwerkingsprofiel') and label='FEEL-E';

create function public.set_order_participant(p_order uuid,p_contact jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders%rowtype;age_years int;instrument text;instrument_id uuid;begin
 select * into o from public.orders where id=p_order for update;
 if o.id is null then raise exception 'order_missing';end if;
 if o.contact_snapshot<>'{}'::jsonb and o.contact_snapshot<>p_contact then raise exception 'submission_conflict';end if;
 if o.status<>'pending_payment' then return;end if;
 age_years:=extract(year from age(timezone('Europe/Brussels',now())::date,(p_contact->>'birth_date')::date));
 if exists(select 1 from public.order_items where order_id=o.id and product_slug='prikkelverwerkingsprofiel') then
  if age_years<8 then raise exception 'invalid_profile_age';end if;
  instrument:=case when age_years<18 then 'FEEL-KJ' else 'FEEL-E' end;
  select id into instrument_id from public.products where slug=lower(instrument);
  if instrument_id is null then raise exception 'missing_profile_variant';end if;
  update public.order_items i set catalog_snapshot=jsonb_set(i.catalog_snapshot,'{components}',(
   select jsonb_agg(case when c->>'title' like 'FEEL-%' then c||jsonb_build_object('id',instrument_id,'title',instrument) else c end order by ord)
   from jsonb_array_elements(i.catalog_snapshot->'components') with ordinality x(c,ord)))
   where i.order_id=o.id and i.product_slug='prikkelverwerkingsprofiel';
 end if;
 update public.orders set contact_snapshot=p_contact where id=o.id;
end $$;
-- Wrap the existing account RPC so contact and age selection are transactional.
create function public.create_account_checkout(p_customer uuid,p_ids uuid[],p_mode text,p_hash text,p_submission uuid,p_contact jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;begin
 result:=public.create_catalog_order(p_customer,p_ids,p_mode,p_hash,p_submission);
 if lower(p_contact->>'email') is distinct from commerce_private.account_email(p_customer) then raise exception 'buyer_mismatch';end if;
 perform public.set_order_participant(result,p_contact);
 return result;
end $$;
do $$declare definition text;begin
 select pg_get_functiondef('public.create_guest_catalog_order(text,uuid[],text,text,uuid,jsonb)'::regprocedure) into definition;
 execute replace(definition,' return result;',' perform public.set_order_participant(result,p_contact); return result;');
end $$;
revoke all on function public.set_order_participant(uuid,jsonb),public.create_account_checkout(uuid,uuid[],text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.set_order_participant(uuid,jsonb),public.create_account_checkout(uuid,uuid[],text,text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
