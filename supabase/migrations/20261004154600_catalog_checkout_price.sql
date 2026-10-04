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
  if v_row.status<>'published' or v_row.availability<>'available' or v_row.price_cents is null or v_row.price_cents<=0 or v_row.currency<>'EUR' or (p_mode='custom' and v_row.type<>'questionnaire') or (p_mode='package' and v_row.type<>'profile') then raise exception 'unavailable_product'; end if;
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
revoke all on function public.catalog_quote(uuid[],text) from public,anon,authenticated;
