import type { APIRoute } from 'astro';
import { CUSTOMER_COOKIE, adminCookieOptions, authenticateUser, createUserSession, isAdminAuthConfigured, isTrustedFormOrigin, sanitizeAppRedirect } from '../../../lib/adminAuth';

type Attempt = { count: number; resetAt: number }; const attempts = new Map<string, Attempt>();
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  if (!isAdminAuthConfigured()) return Response.redirect(new URL('/account/inloggen?error=configuration', request.url), 303);
  const form = await request.formData(); const email = String(form.get('email') || '').trim().toLowerCase(); const password = String(form.get('password') || ''); const key = `${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}:${email}`; const now = Date.now(); const attempt = attempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) return Response.redirect(new URL('/account/inloggen?error=rate_limited', request.url), 303);
  const user = email.length <= 254 && password.length <= 256 ? authenticateUser(email, password) : null;
  if (!user || !user.roles.includes('customer')) { attempts.set(key, { count: (attempt?.count || 0) + 1, resetAt: attempt?.resetAt && attempt.resetAt > now ? attempt.resetAt : now + 15 * 60 * 1000 }); return Response.redirect(new URL('/account/inloggen?error=invalid', request.url), 303); }
  attempts.delete(key); cookies.set(CUSTOMER_COOKIE, createUserSession(user), adminCookieOptions()); const next = sanitizeAppRedirect(form.get('next')); return Response.redirect(new URL(next.startsWith('/account') ? next : '/account', request.url), 303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
