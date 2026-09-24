import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, authenticateSupabaseUser, isCustomerAccount, isTrustedFormOrigin, sanitizeAppRedirect, supabaseSessionCookieOptions } from '../../../lib/adminAuth';

type Attempt = { count: number; resetAt: number }; const attempts = new Map<string, Attempt>();
const redirect303 = (url: URL) => new Response(null, { status: 303, headers: { location: `${url.pathname}${url.search}` } });
export const prerender = false;
const loginRedirect = (request: Request, error: string, nextValue: unknown) => {
  const url = new URL('/account/inloggen', request.url);
  url.searchParams.set('error', error);
  const next = sanitizeAppRedirect(nextValue);
  if (next) url.searchParams.set('next', next);
  return redirect303(url);
};
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const email = String(form.get('email') || '').trim().toLowerCase(); const password = String(form.get('password') || ''); const key = `${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}:${email}`; const now = Date.now(); const attempt = attempts.get(key);
  const next = sanitizeAppRedirect(form.get('next'));
  if (attempt && attempt.resetAt > now && attempt.count >= 5) return loginRedirect(request, 'rate_limited', next);
  let authenticated = null;
  try {
    authenticated = email.length <= 254 && password.length <= 256 ? await authenticateSupabaseUser(email, password) : null;
  } catch {
    console.error('Account login failed because server-side authentication is unavailable.');
    return loginRedirect(request, 'temporarily_unavailable', next);
  }
  if (!authenticated) { attempts.set(key, { count: (attempt?.count || 0) + 1, resetAt: attempt?.resetAt && attempt.resetAt > now ? attempt.resetAt : now + 15 * 60 * 1000 }); return loginRedirect(request, 'invalid', next); }
  if (!isCustomerAccount(authenticated.user)) return loginRedirect(request, 'customer_required', next);
  attempts.delete(key); cookies.set(SUPABASE_SESSION_COOKIE, authenticated.accessToken, supabaseSessionCookieOptions()); return redirect303(new URL(next || '/account', request.url));
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
