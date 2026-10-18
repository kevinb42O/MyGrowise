-- Additive public marketing content. Existing catalog permissions and RLS stay intact.
create function public.valid_questionnaire_landing(p_content jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare v_key text; v_limit integer; v_line jsonb;
begin
 if p_content is null then return true; end if;
 if jsonb_typeof(p_content) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(p_content))<>9
  or not p_content ?& array['schemaVersion','question','introduction','measures','expectations','disclaimer','respondentLabel','formatLabel','reportLabel']
  or p_content->'schemaVersion' is distinct from '1'::jsonb then return false; end if;
 foreach v_key in array array['question','disclaimer','respondentLabel','formatLabel','reportLabel'] loop
  v_limit:=case v_key when 'question' then 320 when 'disclaimer' then 2000 when 'respondentLabel' then 240 else 120 end;
  if jsonb_typeof(p_content->v_key) is distinct from 'string' or length(btrim(p_content->>v_key))=0 or length(p_content->>v_key)>v_limit then return false; end if;
 end loop;
 foreach v_key in array array['introduction','measures','expectations'] loop
  if jsonb_typeof(p_content->v_key) is distinct from 'array' then return false; end if;
  v_limit:=case v_key when 'measures' then 24 else 12 end;
  if jsonb_array_length(p_content->v_key) not between 1 and v_limit then return false; end if;
  for v_line in select value from jsonb_array_elements(p_content->v_key) loop
   if jsonb_typeof(v_line) is distinct from 'string' or length(btrim(v_line#>>'{}'))=0 or length(v_line#>>'{}')>2000 then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
create function public.valid_catalog_audience_groups(p_groups text[]) returns boolean
language sql immutable security invoker set search_path='' as $$
 select p_groups is not null and cardinality(p_groups)<=3
  and p_groups <@ array['children','adolescents','adults']::text[]
  and array_position(p_groups,null) is null
  and cardinality(p_groups)=(select count(distinct x) from unnest(p_groups) x);
$$;
revoke all on function public.valid_questionnaire_landing(jsonb),public.valid_catalog_audience_groups(text[]) from public,anon,authenticated;
grant execute on function public.valid_questionnaire_landing(jsonb),public.valid_catalog_audience_groups(text[]) to service_role;
alter table public.catalog_details
 add column landing_content jsonb,
 add column audience_groups text[] not null default array[]::text[],
 add constraint catalog_landing_content_valid check(public.valid_questionnaire_landing(landing_content)),
 add constraint catalog_audience_groups_valid check(public.valid_catalog_audience_groups(audience_groups)),
 add constraint catalog_landing_audience_required check(landing_content is null or cardinality(audience_groups)>0);

-- Missing new keys preserve previously saved content for older editor submissions.
create or replace function public.save_catalog_product(p_actor uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_component jsonb; v_type public.product_type; v_landing jsonb; v_groups text[] := array[]::text[];
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
 select landing_content,audience_groups into v_landing,v_groups from public.catalog_details where product_id=v_id;
 v_groups:=coalesce(v_groups,array[]::text[]);
 if p_data ? 'landingContent' then v_landing:=nullif(p_data->'landingContent','null'::jsonb); end if;
 if p_data ? 'audienceGroups' then
  if jsonb_typeof(p_data->'audienceGroups') is distinct from 'array' then raise exception 'invalid_audience_groups'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'audienceGroups') x where jsonb_typeof(x)<>'string') then raise exception 'invalid_audience_groups'; end if;
  select coalesce(array_agg(value),array[]::text[]) into v_groups from jsonb_array_elements_text(p_data->'audienceGroups');
 end if;
 if not public.valid_questionnaire_landing(v_landing) then raise exception 'invalid_landing_content'; end if;
 if not public.valid_catalog_audience_groups(v_groups) then raise exception 'invalid_audience_groups'; end if;
 if v_landing is not null and cardinality(v_groups)=0 then raise exception 'missing_audience_groups'; end if;
 insert into public.catalog_details(product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,review_note,image,sort_order,landing_content,audience_groups) values(v_id,p_data->>'category',p_data->>'audience',p_data->>'ageLabel',p_data->>'version',p_data->>'availability',p_data->>'description',p_data->>'includesText',p_data->>'deliveryText',p_data->>'reviewNote',p_data->>'image',(p_data->>'sortOrder')::integer,v_landing,v_groups)
 on conflict(product_id) do update set category=excluded.category,audience=excluded.audience,age_label=excluded.age_label,version=excluded.version,availability=excluded.availability,description=excluded.description,includes_text=excluded.includes_text,delivery_text=excluded.delivery_text,review_note=excluded.review_note,image=excluded.image,sort_order=excluded.sort_order,landing_content=excluded.landing_content,audience_groups=excluded.audience_groups,updated_at=now();
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
revoke all on function public.save_catalog_product(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_catalog_product(uuid,jsonb) to service_role;


notify pgrst, 'reload schema';
