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

export type WiseManualDetails = {
  accountName: string;
  iban: string;
  bic: string;
};

export type WiseManualOrder = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  reference: string;
  paymentClaimedAt: string | null;
  createdAt: string;
  productSlug: string;
};

const isValidIban = (value: string) => {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};

export const getWiseManualDetails = (): WiseManualDetails | null => {
  // These are public payment instructions shown to customers. Environment
  // values may override them for another deployment or account.
  const accountName = String(process.env.WISE_ACCOUNT_NAME || 'iTransform SLU').trim();
  const iban = String(process.env.WISE_IBAN || 'BE81 9675 5029 6524').replace(/\s+/g, '').toUpperCase();
  const bic = String(process.env.WISE_BIC || 'TRWIBEB1XXX').replace(/\s+/g, '').toUpperCase();
  if (!accountName || !isValidIban(iban) || (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic))) return null;
  return { accountName, iban, bic };
};

export const getWiseManualProduct = async (slug: string) => {
  const { data, error } = await getSupabaseAdmin().from('products').select('id,slug,title,type,summary,price_cents,currency').eq('slug', slug.toLowerCase()).eq('status', 'published').not('price_cents', 'is', null).maybeSingle();
  fail(error);
  if (!data) return null;
  const row = data as Row;
  return { id: String(row.id), slug: String(row.slug), title: String(row.title), type: String(row.type), summary: String(row.summary), priceCents: Number(row.price_cents), currency: String(row.currency) };
};

export const createWiseManualOrder = async (customerId: string, productSlug: string) => {
  const { data, error } = await getSupabaseAdmin().rpc('create_wise_manual_order', { p_customer_id: customerId, p_product_slug: productSlug.toLowerCase() });
  if (error?.code === 'P0001') throw new Error('checkout_unavailable');
  fail(error);
  const row = Array.isArray(data) ? data[0] as Row | undefined : undefined;
  if (!row) throw new Error('checkout_unavailable');
  return { id: String(row.order_id), reference: String(row.payment_reference) };
};

export const getWiseManualOrder = async (orderId: string, customerId: string): Promise<WiseManualOrder | null> => {
  const { data, error } = await getSupabaseAdmin().from('orders').select('id,status,total_cents,currency,provider_reference,payment_claimed_at,created_at,order_items(product_slug)').eq('id', orderId).eq('customer_user_id', customerId).eq('provider', 'wise_manual').maybeSingle();
  fail(error);
  if (!data) return null;
  const row = data as Row;
  const item = (Array.isArray(row.order_items) ? row.order_items[0] : row.order_items) as Row | null;
  return { id: String(row.id), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency), reference: String(row.provider_reference), paymentClaimedAt: row.payment_claimed_at ? String(row.payment_claimed_at) : null, createdAt: String(row.created_at), productSlug: String(item?.product_slug || '') };
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
