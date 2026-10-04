import { profilePresentation } from '../content/site';
import { publicCatalog } from './catalog/server';
import { getSupabaseAdmin } from './supabase/server';

export type PublicProduct = {
  slug: string;
  title: string;
  type: 'profile' | 'module' | 'ebook';
  summary: string;
  priceCents: number;
  currency: string;
};

export type PublicProfile = PublicProduct & {
  image: string;
  features: readonly string[];
};

const columns = 'slug,title,type,summary,price_cents,currency';
const toProduct = (row: Record<string, unknown>): PublicProduct => ({
  slug: String(row.slug),
  title: String(row.title),
  type: row.type as PublicProduct['type'],
  summary: String(row.summary),
  priceCents: Number(row.price_cents),
  currency: String(row.currency),
});

export const listPublishedProfiles = async (): Promise<PublicProfile[]> => {
  const products = await publicCatalog();
  return products.filter(p => p.type === 'profile' && p.availability === 'available' && p.priceCents !== null).map(p => ({ ...p, type: 'profile' as const, currency: 'EUR', priceCents: p.priceCents!, features: p.components.map(c=>c.title) }));
};

export const formatPublicPrice = (product: PublicProduct) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: product.currency }).format(product.priceCents / 100);

export const profileUrl = (slug: string) =>
  `/profielen/${slug}`;
