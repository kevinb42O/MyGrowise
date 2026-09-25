import { profilePresentation } from '../content/site';
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
  const { data, error } = await getSupabaseAdmin().from('products').select(columns)
    .eq('type', 'profile').eq('status', 'published').not('price_cents', 'is', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data || []) as Record<string, unknown>[]).map((row) => {
    const product = toProduct(row);
    const editorial = profilePresentation.find((item) => item.slug === product.slug);
    return {
      ...product,
      image: editorial?.image || '/images/editorial/mygrowise-50.jpg',
      features: editorial?.features || [],
    };
  });
};

export const formatPublicPrice = (product: PublicProduct) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: product.currency }).format(product.priceCents / 100);

export const profileUrl = (slug: string) =>
  slug === 'stress-en-emotieprofiel' ? `/profielen/${slug}` : `/aanbod/${slug}`;
