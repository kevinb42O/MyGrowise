import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../lib/adminAuth';
import { getSupabaseAdmin } from '../../lib/supabase/server';
export const prerender = false;
const events = new Set(['page_view', 'route_selected', 'product_viewed', 'checkout_started', 'professional_viewed', 'booking_clicked']);
const attempts = new Map<string, { count: number; resetAt: number }>();
export const POST: APIRoute = async ({ request, cookies }) => {
  if (cookies.get('mg_analytics_consent')?.value !== 'granted') return new Response(null, { status: 204 });
  if (!isTrustedFormOrigin(request)) return new Response(null, { status: 403 });
  let payload: { event?: unknown; path?: unknown; route?: unknown }; try { payload = await request.json(); } catch { return new Response(null, { status: 400 }); }
  const event = String(payload.event || ''); const path = String(payload.path || ''); const route = String(payload.route || '');
  if (!events.has(event) || !/^\/[a-z0-9/_-]{0,499}$/i.test(path) || /^\/(account|admin|praktijk|api)(\/|$)/.test(path) || (route && !['self', 'care'].includes(route))) return new Response(null, { status: 400 });
  let anonymousId = cookies.get('mg_analytics_id')?.value || ''; if (!/^[0-9a-f-]{36}$/i.test(anonymousId)) anonymousId = crypto.randomUUID(); const now = Date.now(); const key = anonymousId; const previous = attempts.get(key); if (previous && previous.resetAt > now && previous.count >= 60) return new Response(null, { status: 429 }); attempts.set(key, { count: (previous?.resetAt && previous.resetAt > now ? previous.count : 0) + 1, resetAt: now + 60_000 });
  const countryHeader = import.meta.env.PROD ? request.headers.get('x-vercel-ip-country')?.toUpperCase() : null;
  const countryCode = countryHeader && /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null;
  const { error } = await getSupabaseAdmin().from('analytics_events').insert({ event_name: event, anonymous_id: anonymousId, path, route_key: route || null, country_code: countryCode, consented: true, environment: import.meta.env.PROD ? 'production' : 'preview' }); if (error) return new Response(null, { status: 500 });
  cookies.set('mg_analytics_id', anonymousId, { httpOnly: true, sameSite: 'lax', secure: import.meta.env.PROD, path: '/', maxAge: 60 * 60 * 24 * 180 }); return new Response(null, { status: 204 });
};
export const DELETE: APIRoute = ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response(null, { status: 403 });
  cookies.delete('mg_analytics_id', { path: '/' });
  cookies.set('mg_analytics_consent', 'denied', { sameSite: 'lax', secure: import.meta.env.PROD, path: '/', maxAge: 60 * 60 * 24 * 180 });
  return new Response(null, { status: 204 });
};
export const ALL: APIRoute = () => new Response(null, { status: 405 });
