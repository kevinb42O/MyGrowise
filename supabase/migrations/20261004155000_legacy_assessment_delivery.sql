-- Existing paid profiles retain the purchased title; do not reconstruct their
-- historical package composition from today's catalog.
insert into public.assessment_deliveries(order_item_id,customer_user_id,component_key,title,instructions)
select i.id,o.customer_user_id,'legacy:'||i.product_slug,i.product_title,'MyGrowise volgt je gekochte profiel persoonlijk op. Hier verschijnen je afname-instructies en beschikbare rapporten.'
from public.order_items i join public.orders o on o.id=i.order_id
where o.status in ('paid','fulfilled') and i.product_type in ('profile','questionnaire')
and not exists(select 1 from public.assessment_deliveries d where d.order_item_id=i.id)
on conflict do nothing;
