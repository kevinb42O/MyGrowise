import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

export const PRODUCT_TYPES = ['profile', 'module', 'ebook'] as const;
export const PRODUCT_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type AdminProduct = {
  id: string; title: string; slug: string; type: ProductType; status: ProductStatus;
  priceCents: number | null; currency: 'EUR'; summary: string; createdAt: string;
  updatedAt: string; updatedBy: string; wisePaymentUrl: string | null;
};
export type ProductInput = Pick<AdminProduct, 'title' | 'slug' | 'type' | 'status' | 'priceCents' | 'summary' | 'wisePaymentUrl'>;
export type ProductValidation = { value?: ProductInput; errors: Record<string, string> };
export type ProductFormFlash = { id?: string; error: string; fields: { title: string; slug: string; type: string; status: string; price: string; summary: string; wisePaymentUrl: string } };

export const PRODUCT_FLASH_COOKIE = 'mg_product_form';
export const productFlashCookieOptions = () => ({ httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict' as const, path: '/admin/producten', maxAge: 120 });
export const encodeProductFormFlash = (form: FormData, error: string, id?: string) => Buffer.from(JSON.stringify({
  id, error, fields: {
    title: String(form.get('title') || '').slice(0, 120), slug: String(form.get('slug') || '').slice(0, 80),
    type: String(form.get('type') || '').slice(0, 20), status: String(form.get('status') || '').slice(0, 20),
    price: String(form.get('price') || '').slice(0, 10), summary: String(form.get('summary') || '').slice(0, 320), wisePaymentUrl: String(form.get('wise_payment_url') || '').slice(0, 1000),
  },
} satisfies ProductFormFlash)).toString('base64url');
export const decodeProductFormFlash = (token?: string): ProductFormFlash | null => {
  if (!token || token.length > 1200) return null;
  try { const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as ProductFormFlash; return value && typeof value.error === 'string' && value.fields && typeof value.fields.title === 'string' ? value : null; } catch { return null; }
};

const rowToProduct = (row: Record<string, unknown>): AdminProduct => ({
  id: String(row.id), title: String(row.title), slug: String(row.slug), type: row.type as ProductType, status: row.status as ProductStatus,
  priceCents: row.price_cents === null ? null : Number(row.price_cents), currency: 'EUR', summary: String(row.summary), wisePaymentUrl: row.wise_payment_url ? String(row.wise_payment_url) : null,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at), updatedBy: row.updated_by ? 'Superadmin' : 'Catalogusmigratie',
});
const databaseFailure = (error: { code?: string } | null) => { if (!error) return; if (error.code === '23505') throw new Error('duplicate_slug'); throw new Error('database_error'); };
const columns = 'id,title,slug,type,status,summary,price_cents,currency,wise_payment_url,created_at,updated_at,updated_by';

export const listProducts = async (): Promise<AdminProduct[]> => {
  const { data, error } = await getSupabaseAdmin().from('products').select(columns).order('updated_at', { ascending: false });
  databaseFailure(error); return ((data || []) as Record<string, unknown>[]).map(rowToProduct);
};
export const getProduct = async (id: string): Promise<AdminProduct | null> => {
  const { data, error } = await getSupabaseAdmin().from('products').select(columns).eq('id', id).maybeSingle();
  databaseFailure(error); return data ? rowToProduct(data as Record<string, unknown>) : null;
};

export type ProductAuditEvent = { occurredAt: string; actor: string; action: 'product.created' | 'product.updated'; objectId: string; before?: AdminProduct; after?: AdminProduct };
export const listProductAuditEvents = async (limit = 10): Promise<ProductAuditEvent[]> => {
  const { data, error } = await getSupabaseAdmin().from('security_audit_log').select('occurred_at,action,object_id,metadata').in('action', ['product.created', 'product.updated']).order('occurred_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 50));
  databaseFailure(error);
  return ((data || []) as Record<string, unknown>[]).map((row) => ({ occurredAt: String(row.occurred_at), actor: 'Superadmin', action: row.action as ProductAuditEvent['action'], objectId: String(row.object_id), after: (row.metadata as { after?: AdminProduct })?.after }));
};

export const slugifyProduct = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
export const validateProductForm = (form: FormData): ProductValidation => {
  const title = String(form.get('title') || '').trim(); const slug = slugifyProduct(String(form.get('slug') || title)); const type = String(form.get('type') || '') as ProductType; const status = String(form.get('status') || '') as ProductStatus; const summary = String(form.get('summary') || '').trim(); const rawPrice = String(form.get('price') || '').trim().replace(',', '.'); const wisePaymentUrl = String(form.get('wise_payment_url') || '').trim(); const errors: Record<string, string> = {};
  if (title.length < 3 || title.length > 120) errors.title = 'Gebruik tussen 3 en 120 tekens.';
  if (!slug || slug.length > 80) errors.slug = 'Vul een geldige URL-slug van maximaal 80 tekens in.';
  if (!PRODUCT_TYPES.includes(type)) errors.type = 'Kies een geldig producttype.';
  if (!PRODUCT_STATUSES.includes(status)) errors.status = 'Kies een geldige status.';
  if (summary.length < 20 || summary.length > 320) errors.summary = 'Gebruik tussen 20 en 320 tekens.';
  let priceCents: number | null = null;
  if (rawPrice) { const amount = Number(rawPrice); if (!Number.isFinite(amount) || amount < 0 || amount > 100000 || !/^\d{1,6}([.,]\d{1,2})?$/.test(String(form.get('price') || '').trim())) errors.price = 'Vul een bedrag in met maximaal twee decimalen.'; else priceCents = Math.round(amount * 100); }
  if (status === 'published' && priceCents === null) errors.price = 'Een gepubliceerd product heeft een prijs nodig.';
  if (wisePaymentUrl) {
    try { const parsed = new URL(wisePaymentUrl); if (parsed.protocol !== 'https:' || !(parsed.hostname === 'wise.com' || parsed.hostname.endsWith('.wise.com'))) errors.wisePaymentUrl = 'Gebruik de officiële HTTPS-betaallink van Wise.'; } catch { errors.wisePaymentUrl = 'Gebruik een geldige officiële Wise-betaallink.'; }
  }
  return Object.keys(errors).length ? { errors } : { errors, value: { title, slug, type, status, summary, priceCents, wisePaymentUrl: wisePaymentUrl || null } };
};

const auditProduct = async (action: ProductAuditEvent['action'], product: AdminProduct, actor: AuditActor, before?: AdminProduct) => {
  await writeSecurityAudit({ actor, action, objectType: 'product', objectId: product.id, before, after: product });
};
export const createProduct = async (input: ProductInput, actor: AuditActor) => {
  const { data, error } = await getSupabaseAdmin().from('products').insert({ title: input.title, slug: input.slug, type: input.type, status: input.status, summary: input.summary, price_cents: input.priceCents, wise_payment_url: input.wisePaymentUrl, currency: 'EUR', updated_by: actor.userId || null }).select(columns).single();
  databaseFailure(error); const product = rowToProduct(data as Record<string, unknown>); await auditProduct('product.created', product, actor); return product;
};
export const updateProduct = async (id: string, input: ProductInput, actor: AuditActor) => {
  const before = await getProduct(id);
  if (!before) throw new Error('not_found');
  const { data, error } = await getSupabaseAdmin().from('products').update({ title: input.title, slug: input.slug, type: input.type, status: input.status, summary: input.summary, price_cents: input.priceCents, wise_payment_url: input.wisePaymentUrl, updated_by: actor.userId || null }).eq('id', id).select(columns).maybeSingle();
  databaseFailure(error); if (!data) throw new Error('not_found'); const product = rowToProduct(data as Record<string, unknown>); await auditProduct('product.updated', product, actor, before); return product;
};

export const formatProductPrice = (priceCents: number | null) => priceCents === null ? 'Nog niet geprijsd' : new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(priceCents / 100);
export const productTypeLabel: Record<ProductType, string> = { profile: 'Persoonlijk profiel', module: 'Online module', ebook: 'E-book' };
export const productStatusLabel: Record<ProductStatus, string> = { draft: 'Concept', review: 'In review', published: 'Gepubliceerd', archived: 'Gearchiveerd' };
