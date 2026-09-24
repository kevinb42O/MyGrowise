-- Manual Wise bank transfer checkout and operator-controlled reconciliation.
-- The Wise statement stays in Wise. MyGrowise stores order references and a
-- human confirmation after Virginie has compared the statement herself.

create unique index orders_one_active_wise_manual_idx
  on public.orders (customer_user_id, checkout_product_id)
  where provider = 'wise_manual' and status = 'pending_payment';

create index orders_wise_manual_reconciliation_idx
  on public.orders (payment_claimed_at asc, created_at asc)
  where provider = 'wise_manual' and status = 'pending_payment';

create or replace function public.create_wise_manual_order(
  p_customer_id uuid,
  p_product_slug text
)
returns table (order_id uuid, payment_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_order_id uuid;
  v_reference text;
begin
  if p_customer_id is null or nullif(trim(p_product_slug), '') is null then
    raise exception 'Invalid checkout request' using errcode = '22023';
  end if;

  select * into v_product
  from public.products
  where slug = lower(trim(p_product_slug))
    and status = 'published'
    and price_cents is not null
  limit 1;

  if v_product.id is null then
    raise exception 'Product is unavailable for Wise payment' using errcode = 'P0001';
  end if;

  select id into v_order_id
  from public.orders
  where customer_user_id = p_customer_id
    and checkout_product_id = v_product.id
    and provider = 'wise_manual'
    and status = 'pending_payment'
  order by created_at desc
  limit 1;

  if v_order_id is null then
    v_reference := 'MG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    begin
      insert into public.orders (
        customer_user_id, checkout_product_id, status, total_cents, currency,
        provider, provider_reference, wise_payment_url
      ) values (
        p_customer_id, v_product.id, 'pending_payment', v_product.price_cents, v_product.currency,
        'wise_manual', v_reference, null
      ) returning id into v_order_id;

      insert into public.order_items (
        order_id, product_id, product_title, product_slug, product_type, price_cents
      ) values (
        v_order_id, v_product.id, v_product.title, v_product.slug, v_product.type, v_product.price_cents
      );
    exception when unique_violation then
      select id into v_order_id
      from public.orders
      where customer_user_id = p_customer_id
        and checkout_product_id = v_product.id
        and provider = 'wise_manual'
        and status = 'pending_payment'
      order by created_at desc
      limit 1;
    end;
  end if;

  return query
  select o.id, o.provider_reference
  from public.orders o
  where o.id = v_order_id;
end;
$$;

create or replace function public.claim_wise_manual_payment(
  p_order_id uuid,
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set payment_claimed_at = coalesce(payment_claimed_at, now()), updated_at = now()
  where id = p_order_id
    and customer_user_id = p_customer_id
    and provider = 'wise_manual'
    and status = 'pending_payment';
  if not found then
    raise exception 'Order is unavailable for payment claim' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.confirm_wise_manual_payment(
  p_order_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and provider = 'wise_manual'
  for update;

  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status in ('paid', 'fulfilled') then
    return;
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'Order is not awaiting payment' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'paid', payment_verified_at = now(), payment_verified_by = p_actor_id, updated_at = now()
  where id = p_order_id;

  for v_item in
    select * from public.order_items where order_id = p_order_id
  loop
    insert into public.entitlements (
      customer_user_id, order_item_id, product_id, product_title, product_slug, product_type, status
    ) values (
      v_order.customer_user_id, v_item.id, v_item.product_id, v_item.product_title,
      v_item.product_slug, v_item.product_type, 'active'
    ) on conflict do nothing;
  end loop;

  insert into public.security_audit_log (actor_user_id, action, object_type, object_id, metadata)
  values (
    p_actor_id, 'order.wise_manual_payment_verified', 'order', p_order_id::text,
    jsonb_build_object('provider_reference', v_order.provider_reference, 'amount_cents', v_order.total_cents, 'currency', v_order.currency)
  );
end;
$$;

revoke all on function public.create_wise_manual_order(uuid, text) from public;
revoke all on function public.claim_wise_manual_payment(uuid, uuid) from public;
revoke all on function public.confirm_wise_manual_payment(uuid, uuid) from public;
grant execute on function public.create_wise_manual_order(uuid, text) to service_role;
grant execute on function public.claim_wise_manual_payment(uuid, uuid) to service_role;
grant execute on function public.confirm_wise_manual_payment(uuid, uuid) to service_role;
