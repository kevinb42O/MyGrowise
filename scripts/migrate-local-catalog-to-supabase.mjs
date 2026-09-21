import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.');

const source = JSON.parse(await readFile(new URL('../data/admin/products.json', import.meta.url), 'utf8'));
if (!Array.isArray(source)) throw new Error('The local product catalog is invalid.');

const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const records = source.map((product) => ({
  title: String(product.title),
  slug: String(product.slug),
  type: String(product.type),
  status: String(product.status),
  summary: String(product.summary),
  price_cents: product.priceCents === null ? null : Number(product.priceCents),
  currency: String(product.currency || 'EUR'),
  created_at: String(product.createdAt),
  updated_at: String(product.updatedAt),
}));

const { error } = await client.from('products').upsert(records, { onConflict: 'slug', ignoreDuplicates: false });
if (error) throw error;
console.log(`Migrated ${records.length} catalog products to Supabase.`);
