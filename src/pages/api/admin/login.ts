import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, authenticateSupabaseUser, hasPermission, isSupabaseAuthConfigured, isTrustedFormOrigin, sanitizeAppRedirect, supabaseSessionCookieOptions } from '../../../lib/adminAuth';
import { firstAccessibleAdminPath, requiredAdminPermission } from '../../../lib/adminPermissions';

export const prerender = false;
type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>(); const WINDOW_MS = 15 * 60 * 1000; const MAX_ATTEMPTS = 5;
const redirectToLogin = (url: URL, error: string, next = '/admin') => { const loginPath = next.startsWith('/praktijk') ? '/praktijk/login' : '/admin/login'; const target = new URL(loginPath, url); target.searchParams.set('error', error); if (next !== '/admin') target.searchParams.set('next', next); return new Response(null, { status: 303, headers: { location: target.pathname + target.search } }); };

export const POST: APIRoute = async ({ request, cookies, url, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  if (!isSupabaseAuthConfigured()) return redirectToLogin(url, 'configuration');
  let form: FormData; try { form = await request.formData(); } catch { return redirectToLogin(url, 'invalid'); }
  const email = typeof form.get('email') === 'string' ? String(form.get('email')).trim().toLowerCase() : ''; const password = typeof form.get('password') === 'string' ? String(form.get('password')) : ''; const requestedNext = sanitizeAppRedirect(form.get('next'));
  const clientKey = `${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}:${email.slice(0, 160)}`; const now = Date.now(); const previous = attempts.get(clientKey);
  if (previous && previous.resetAt > now && previous.count >= MAX_ATTEMPTS) return redirectToLogin(url, 'rate_limited', requestedNext || '/admin');
  if (previous && previous.resetAt <= now) attempts.delete(clientKey);
  const authenticated = email.length <= 254 && password.length > 0 && password.length <= 256 ? await authenticateSupabaseUser(email, password, true, locals.requestId) : null;
  const adminDestination = authenticated ? firstAccessibleAdminPath(authenticated.user.roles) : null;
  if (!authenticated || (!adminDestination && !(authenticated.user.roles.includes('practitioner') && authenticated.user.practitionerId))) { const current = attempts.get(clientKey); attempts.set(clientKey, { count: (current?.count || 0) + 1, resetAt: current?.resetAt && current.resetAt > now ? current.resetAt : now + WINDOW_MS }); await new Promise((resolve) => setTimeout(resolve, 250)); return redirectToLogin(url, 'invalid', requestedNext || '/admin'); }
  attempts.delete(clientKey); cookies.set(SUPABASE_SESSION_COOKIE, authenticated.accessToken, supabaseSessionCookieOptions());
  const requestedPath = requestedNext ? new URL(requestedNext, url.origin).pathname : '';
  const requestedPermission = requestedPath ? requiredAdminPermission(requestedPath) : null;
  const canOpenPracticeDestination = requestedNext.startsWith('/praktijk') && authenticated.user.roles.includes('practitioner') && Boolean(authenticated.user.practitionerId);
  const destination = requestedPermission && hasPermission(authenticated.user, requestedPermission)
    ? requestedNext
    : canOpenPracticeDestination ? requestedNext : adminDestination || '/praktijk';
  const destinationPath = new URL(destination, url.origin).pathname;
  const destinationPermission = requiredAdminPermission(destinationPath);
  const canOpenRequested = (destination.startsWith('/admin') && Boolean(destinationPermission) && hasPermission(authenticated.user, destinationPermission!)) || (destination.startsWith('/praktijk') && authenticated.user.roles.includes('practitioner') && authenticated.user.practitionerId);
  return canOpenRequested ? new Response(null, { status: 303, headers: { location: destination } }) : redirectToLogin(url, 'forbidden', destination);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
