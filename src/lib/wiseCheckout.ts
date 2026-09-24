import { getSupabaseAdmin } from './supabase/server';

type Row = Record<string, unknown>;
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'database_error'); };

export type WiseCheckoutProduct = {
  id: string;
  slug: string;
  title: string;
  type: string;
  summary: string;
  priceCents: number;
  currency: string;
  paymentUrl: string;
};

const toProduct = (row: Row): WiseCheckoutProduct => ({
  id: String(row.id), slug: String(row.slug), title: String(row.title), type: String(row.type), summary: String(row.summary),
  priceCents: Number(row.price_cents), currency: String(row.currency), paymentUrl: String(row.wise_payment_url),
});

export const isWiseHostedPaymentUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'wise.com' || url.hostname.endsWith('.wise.com'));
  } catch { return false; }
};

export const getWiseCheckoutProduct = async (slug: string): Promise<WiseCheckoutProduct | null> => {
  const { data, error } = await getSupabaseAdmin().from('products').select('id,slug,title,type,summary,price_cents,currency,wise_payment_url').eq('slug', slug.toLowerCase()).eq('status', 'published').not('price_cents', 'is', null).not('wise_payment_url', 'is', null).maybeSingle();
  fail(error);
  if (!data || !isWiseHostedPaymentUrl(String((data as Row).wise_payment_url || ''))) return null;
  return toProduct(data as Row);
};

export const startWiseCheckout = async (customerId: string, productSlug: string) => {
  const { data, error } = await getSupabaseAdmin().rpc('create_wise_checkout_order', { p_customer_id: customerId, p_product_slug: productSlug.toLowerCase() });
  if (error?.code === 'P0001') throw new Error('checkout_unavailable');
  fail(error);
  const result = Array.isArray(data) ? data[0] as Row | undefined : undefined;
  if (!result || !isWiseHostedPaymentUrl(String(result.payment_url || ''))) throw new Error('checkout_unavailable');
  return { orderId: String(result.order_id), paymentUrl: String(result.payment_url), paymentReference: String(result.payment_reference) };
};
