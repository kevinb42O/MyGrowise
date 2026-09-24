import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, authenticateSupabaseUser, isTrustedFormOrigin, sanitizeAppRedirect, supabaseSessionCookieOptions } from '../../../lib/adminAuth';

type Attempt = { count: number; resetAt: number }; const attempts = new Map<string, Attempt>();
const redirect303 = (url: URL) => new Response(null, { status: 303, headers: { location: `${url.pathname}${url.search}` } });
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const email = String(form.get('email') || '').trim().toLowerCase(); const password = String(form.get('password') || ''); const key = `${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}:${email}`; const now = Date.now(); const attempt = attempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) return redirect303(new URL('/account/inloggen?error=rate_limited', request.url));
  let authenticated = null;
  try {
    authenticated = email.length <= 254 && password.length <= 256 ? await authenticateSupabaseUser(email, password) : null;
  } catch {
    console.error('Account login failed because server-side authentication is unavailable.');
    return redirect303(new URL('/account/inloggen?error=temporarily_unavailable', request.url));
  }
  if (!authenticated || !authenticated.user.roles.includes('customer')) { attempts.set(key, { count: (attempt?.count || 0) + 1, resetAt: attempt?.resetAt && attempt.resetAt > now ? attempt.resetAt : now + 15 * 60 * 1000 }); return redirect303(new URL('/account/inloggen?error=invalid', request.url)); }
  attempts.delete(key); cookies.set(SUPABASE_SESSION_COOKIE, authenticated.accessToken, supabaseSessionCookieOptions()); const next = sanitizeAppRedirect(form.get('next')); return redirect303(new URL(next || '/account', request.url));
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
