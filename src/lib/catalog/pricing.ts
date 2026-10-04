export type PricingSettings = { mediumMin: number; mediumPercent: number; largeMin: number; largePercent: number; priceLabel: string };
export const defaultPricing: PricingSettings = { mediumMin: 2, mediumPercent: 5, largeMin: 4, largePercent: 10, priceLabel: 'Eenmalige prijs' };
export const money = (cents: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const discountPercent = (count: number, settings: PricingSettings) => count >= settings.largeMin ? settings.largePercent : count >= settings.mediumMin ? settings.mediumPercent : 0;
export function calculatePrice(items: { id: string; priceCents: number }[], mode: 'package' | 'custom', settings = defaultPricing) {
  if (!items.length || items.length > 30 || new Set(items.map(x => x.id)).size !== items.length || mode === 'package' && items.length !== 1 || items.some(x => !Number.isSafeInteger(x.priceCents) || x.priceCents < 0 || x.priceCents > 10_000_000)) throw new Error('invalid_selection');
  const subtotalCents = items.reduce((sum, x) => sum + x.priceCents, 0);
  const percent = mode === 'package' ? 0 : discountPercent(items.length, settings);
  const totalCents = Math.floor((subtotalCents * (100 - percent) + 50) / 100);
  const lines = items.map(x => ({ ...x, payableCents: Math.floor(x.priceCents * (100 - percent) / 100), remainder: x.priceCents * (100 - percent) % 100 }));
  let remaining = totalCents - lines.reduce((sum, x) => sum + x.payableCents, 0);
  const ranked = [...lines].sort((a, b) => b.remainder - a.remainder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const line of ranked) { if (remaining-- > 0) line.payableCents++; }
  return { subtotalCents, discountPercent: percent, discountCents: subtotalCents - totalCents, totalCents, lines };
}
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const safeExternalUrl = (value: string) => { if (!value.trim()) return ''; try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
