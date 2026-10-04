-- Supabase's default function privileges can grant anon/authenticated directly.
-- Revoking PUBLIC alone does not revoke those explicit grants.
revoke all on function public.catalog_quote(uuid[],text) from public,anon,authenticated;
revoke all on function public.create_catalog_order(uuid,uuid[],text,text,uuid) from public,anon,authenticated;
revoke all on function public.save_catalog_product(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.save_catalog_pricing(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_assessment_delivery(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.create_paid_assessment_deliveries() from public,anon,authenticated;
revoke all on function public.create_wise_manual_order(uuid,text) from public,anon,authenticated;
revoke all on function public.create_legacy_wise_manual_order(uuid,text) from public,anon,authenticated;
revoke all on function public.confirm_wise_manual_payment(uuid,uuid) from public,anon,authenticated;
revoke all on function public.claim_wise_manual_payment(uuid,uuid) from public,anon,authenticated;
alter table public.catalog_pricing add constraint catalog_discount_less_than_free check(large_percent<100);
