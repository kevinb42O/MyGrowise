import type { APIRoute } from 'astro';
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  authenticateUser,
  createUserSession,
  isAdminAuthConfigured,
  isTrustedFormOrigin,
  sanitizeAppRedirect,
} from '../../../lib/adminAuth';

export const prerender = false;

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const redirectToLogin = (url: URL, error: string, next = '/admin') => {
  const loginPath = next.startsWith('/praktijk') ? '/praktijk/login' : '/admin/login';
  const target = new URL(loginPath, url);
  target.searchParams.set('error', error);
  if (next !== '/admin') target.searchParams.set('next', next);
  return new Response(null, { status: 303, headers: { location: target.pathname + target.search } });
};

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  if (!isAdminAuthConfigured()) return redirectToLogin(url, 'configuration');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirectToLogin(url, 'invalid');
  }

  const email = typeof form.get('email') === 'string' ? String(form.get('email')).trim().toLowerCase() : '';
  const password = typeof form.get('password') === 'string' ? String(form.get('password')) : '';
  const requestedNext = sanitizeAppRedirect(form.get('next'));
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientKey = `${forwardedFor || 'local'}:${email.slice(0, 160)}`;
  const now = Date.now();
  const previous = attempts.get(clientKey);

  if (previous && previous.resetAt > now && previous.count >= MAX_ATTEMPTS) {
    return redirectToLogin(url, 'rate_limited', requestedNext || '/admin');
  }
  if (previous && previous.resetAt <= now) attempts.delete(clientKey);

  const validShape = email.length <= 254 && password.length > 0 && password.length <= 256;
  const user = validShape ? authenticateUser(email, password) : null;
  if (!user || !user.roles.some((role) => role === 'super_admin' || role === 'practitioner')) {
    const current = attempts.get(clientKey);
    attempts.set(clientKey, {
      count: (current?.count || 0) + 1,
      resetAt: current?.resetAt && current.resetAt > now ? current.resetAt : now + WINDOW_MS,
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    return redirectToLogin(url, 'invalid', requestedNext || '/admin');
  }

  attempts.delete(clientKey);
  cookies.set(ADMIN_COOKIE, createUserSession(user), adminCookieOptions());
  const destination = requestedNext || '/admin';
  const canOpenRequested = (destination.startsWith('/admin') && user.roles.includes('super_admin')) || (destination.startsWith('/praktijk') && user.roles.includes('practitioner'));
  if (!canOpenRequested) return redirectToLogin(url, 'forbidden', destination);
  return new Response(null, { status: 303, headers: { location: destination } });
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
