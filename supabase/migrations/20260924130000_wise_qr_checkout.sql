-- Wise Business QR checkout foundation. The public Wise API does not create
-- payment links, so the authoritative hosted URL is configured by a superadmin
-- after creating a fixed-amount QR/payment link in Wise Business.

alter table public.products
  add column wise_payment_url text;

alter table public.orders
  add column checkout_product_id uuid references public.products(id) on delete set null,
  add column wise_payment_url text,
  add column payment_claimed_at timestamptz,
  add column payment_verified_at timestamptz,
  add column payment_verified_by uuid references public.profiles(id) on delete set null;

alter table public.products
  add constraint products_wise_payment_url_format check (
    wise_payment_url is null
    or wise_payment_url ~ '^https://([A-Za-z0-9-]+\\.)?wise\\.com/'
  );

alter table public.orders
  add constraint orders_wise_payment_url_format check (
    wise_payment_url is null
    or wise_payment_url ~ '^https://([A-Za-z0-9-]+\\.)?wise\\.com/'
  ),
  add constraint orders_wise_claim_after_creation check (
    payment_claimed_at is null or payment_claimed_at >= created_at
  ),
  add constraint orders_wise_verified_after_creation check (
    payment_verified_at is null or payment_verified_at >= created_at
  );

-- One active payment attempt for an account/product prevents accidental duplicate
-- orders from double-clicking the external Wise hand-off.
create unique index orders_one_active_wise_checkout_idx
  on public.orders (customer_user_id, checkout_product_id)
  where provider = 'wise_qr' and status = 'pending_payment';

create index orders_wise_reconciliation_idx
  on public.orders (payment_claimed_at asc, created_at asc)
  where provider = 'wise_qr' and status = 'pending_payment';

create or replace function public.create_wise_checkout_order(
  p_customer_id uuid,
  p_product_slug text
)
returns table (order_id uuid, payment_url text, payment_reference text)
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
    and wise_payment_url is not null
  limit 1;

  if v_product.id is null then
    raise exception 'Product is unavailable for Wise payment' using errcode = 'P0001';
  end if;

  select id into v_order_id
  from public.orders
  where customer_user_id = p_customer_id
    and checkout_product_id = v_product.id
    and provider = 'wise_qr'
    and status = 'pending_payment'
  order by created_at desc
  limit 1;

  if v_order_id is null then
    v_reference := 'MG-WISE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.orders (
        customer_user_id, checkout_product_id, status, total_cents, currency,
        provider, provider_reference, wise_payment_url
      ) values (
        p_customer_id, v_product.id, 'pending_payment', v_product.price_cents, v_product.currency,
        'wise_qr', v_reference, v_product.wise_payment_url
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
        and provider = 'wise_qr'
        and status = 'pending_payment'
      order by created_at desc
      limit 1;
    end;
  end if;

  return query
  select v_order_id, v_product.wise_payment_url,
    coalesce((select provider_reference from public.orders where id = v_order_id), 'MG-WISE');
end;
$$;

revoke all on function public.create_wise_checkout_order(uuid, text) from public;
grant execute on function public.create_wise_checkout_order(uuid, text) to service_role;
