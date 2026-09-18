import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRODUCT_TYPES = ['profile', 'module', 'ebook'] as const;
export const PRODUCT_STATUSES = ['draft', 'review', 'published', 'archived'] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type AdminProduct = {
  id: string;
  title: string;
  slug: string;
  type: ProductType;
  status: ProductStatus;
  priceCents: number | null;
  currency: 'EUR';
  summary: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type ProductInput = Pick<AdminProduct, 'title' | 'slug' | 'type' | 'status' | 'priceCents' | 'summary'>;
export type ProductValidation = { value?: ProductInput; errors: Record<string, string> };
export type ProductFormFlash = {
  id?: string;
  error: string;
  fields: { title: string; slug: string; type: string; status: string; price: string; summary: string };
};

export const PRODUCT_FLASH_COOKIE = 'mg_product_form';
export const productFlashCookieOptions = () => ({
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'strict' as const,
  path: '/admin/producten',
  maxAge: 120,
});

export const encodeProductFormFlash = (form: FormData, error: string, id?: string) => Buffer.from(JSON.stringify({
  id,
  error,
  fields: {
    title: String(form.get('title') || '').slice(0, 120),
    slug: String(form.get('slug') || '').slice(0, 80),
    type: String(form.get('type') || '').slice(0, 20),
    status: String(form.get('status') || '').slice(0, 20),
    price: String(form.get('price') || '').slice(0, 10),
    summary: String(form.get('summary') || '').slice(0, 320),
  },
} satisfies ProductFormFlash)).toString('base64url');

export const decodeProductFormFlash = (token?: string): ProductFormFlash | null => {
  if (!token || token.length > 1200) return null;
  try {
    const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as ProductFormFlash;
    if (!value || typeof value.error !== 'string' || !value.fields || typeof value.fields.title !== 'string') return null;
    return value;
  } catch {
    return null;
  }
};

const dataDirectory = process.env.ADMIN_DATA_DIR || path.join(process.cwd(), 'data', 'admin');
const productsFile = path.join(dataDirectory, 'products.json');
const auditFile = path.join(dataDirectory, 'audit-log.jsonl');
let writeQueue = Promise.resolve();

const isProduct = (value: unknown): value is AdminProduct => {
  if (!value || typeof value !== 'object') return false;
  const product = value as Partial<AdminProduct>;
  return Boolean(
    typeof product.id === 'string' &&
    typeof product.title === 'string' &&
    typeof product.slug === 'string' &&
    PRODUCT_TYPES.includes(product.type as ProductType) &&
    PRODUCT_STATUSES.includes(product.status as ProductStatus) &&
    (product.priceCents === null || Number.isInteger(product.priceCents)) &&
    product.currency === 'EUR' &&
    typeof product.summary === 'string' &&
    typeof product.createdAt === 'string' &&
    typeof product.updatedAt === 'string' &&
    typeof product.updatedBy === 'string'
  );
};

export const listProducts = async (): Promise<AdminProduct[]> => {
  try {
    const raw = await readFile(productsFile, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isProduct)) throw new Error('Invalid product data.');
    return parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};

export const getProduct = async (id: string) => (await listProducts()).find((product) => product.id === id) || null;

export type ProductAuditEvent = {
  occurredAt: string;
  actor: string;
  action: 'product.created' | 'product.updated';
  objectId: string;
  before?: AdminProduct;
  after?: AdminProduct;
};

export const listProductAuditEvents = async (limit = 10): Promise<ProductAuditEvent[]> => {
  try {
    const raw = await readFile(auditFile, 'utf8');
    return raw.split('\n').filter(Boolean).flatMap((line) => {
      try {
        const event = JSON.parse(line) as ProductAuditEvent;
        return event && typeof event.occurredAt === 'string' && typeof event.actor === 'string' && typeof event.action === 'string' ? [event] : [];
      } catch {
        return [];
      }
    }).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, Math.max(0, Math.min(limit, 50)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
};

export const slugifyProduct = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

export const validateProductForm = (form: FormData): ProductValidation => {
  const title = String(form.get('title') || '').trim();
  const slug = slugifyProduct(String(form.get('slug') || title));
  const type = String(form.get('type') || '') as ProductType;
  const status = String(form.get('status') || '') as ProductStatus;
  const summary = String(form.get('summary') || '').trim();
  const rawPrice = String(form.get('price') || '').trim().replace(',', '.');
  const errors: Record<string, string> = {};

  if (title.length < 3 || title.length > 120) errors.title = 'Gebruik tussen 3 en 120 tekens.';
  if (!slug || slug.length > 80) errors.slug = 'Vul een geldige URL-slug van maximaal 80 tekens in.';
  if (!PRODUCT_TYPES.includes(type)) errors.type = 'Kies een geldig producttype.';
  if (!PRODUCT_STATUSES.includes(status)) errors.status = 'Kies een geldige status.';
  if (summary.length < 20 || summary.length > 320) errors.summary = 'Gebruik tussen 20 en 320 tekens.';

  let priceCents: number | null = null;
  if (rawPrice) {
    const amount = Number(rawPrice);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000 || !/^\d{1,6}([.,]\d{1,2})?$/.test(String(form.get('price') || '').trim())) {
      errors.price = 'Vul een bedrag in met maximaal twee decimalen.';
    } else {
      priceCents = Math.round(amount * 100);
    }
  }
  if (status === 'published' && priceCents === null) errors.price = 'Een gepubliceerd product heeft een prijs nodig.';

  if (Object.keys(errors).length) return { errors };
  return { errors, value: { title, slug, type, status, summary, priceCents } };
};

const persistProducts = async (products: AdminProduct[]) => {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${productsFile}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(products, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryFile, productsFile);
};

const audit = async (event: Record<string, unknown>) => {
  await mkdir(dataDirectory, { recursive: true });
  await appendFile(auditFile, `${JSON.stringify({ occurredAt: new Date().toISOString(), ...event })}\n`, { encoding: 'utf8', mode: 0o600 });
};

const queueWrite = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
};

export const createProduct = (input: ProductInput, actor: string) => queueWrite(async () => {
  const products = await listProducts();
  if (products.some((product) => product.slug === input.slug)) throw new Error('duplicate_slug');
  const now = new Date().toISOString();
  const product: AdminProduct = {
    id: `prod_${randomUUID()}`,
    ...input,
    currency: 'EUR',
    createdAt: now,
    updatedAt: now,
    updatedBy: actor,
  };
  await persistProducts([product, ...products]);
  await audit({ actor, action: 'product.created', objectId: product.id, after: product });
  return product;
});

export const updateProduct = (id: string, input: ProductInput, actor: string) => queueWrite(async () => {
  const products = await listProducts();
  const index = products.findIndex((product) => product.id === id);
  if (index < 0) throw new Error('not_found');
  if (products.some((product) => product.id !== id && product.slug === input.slug)) throw new Error('duplicate_slug');
  const before = products[index];
  const updated: AdminProduct = { ...before, ...input, updatedAt: new Date().toISOString(), updatedBy: actor };
  products[index] = updated;
  await persistProducts(products);
  await audit({ actor, action: 'product.updated', objectId: id, before, after: updated });
  return updated;
});

export const formatProductPrice = (priceCents: number | null) => priceCents === null
  ? 'Nog niet geprijsd'
  : new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(priceCents / 100);

export const productTypeLabel: Record<ProductType, string> = {
  profile: 'Persoonlijk profiel',
  module: 'Online module',
  ebook: 'E-book',
};

export const productStatusLabel: Record<ProductStatus, string> = {
  draft: 'Concept',
  review: 'In review',
  published: 'Gepubliceerd',
  archived: 'Gearchiveerd',
};
