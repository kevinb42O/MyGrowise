import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, isTrustedFormOrigin, registerSupabaseCustomer, sanitizeAppRedirect, supabaseSessionCookieOptions } from '../../../lib/adminAuth';

export const prerender = false;
const redirect303 = (url: URL) => new Response(null, { status: 303, headers: { location: `${url.pathname}${url.search}` } });
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const password = String(form.get('password') || '');
  if (password !== String(form.get('confirm_password') || '')) return redirect303(new URL('/account/aanmaken?error=invalid', request.url));
  try {
    const next = sanitizeAppRedirect(form.get('next'));
    const confirmation = new URL('/account/inloggen?confirmed=1', request.url);
    if (next) confirmation.searchParams.set('next', next);
    const confirmationUrl = confirmation.toString();
    const result = await registerSupabaseCustomer(String(form.get('name') || ''), String(form.get('email') || '').trim().toLowerCase(), password, confirmationUrl);
    if (result.confirmationRequired) {
      const login = new URL('/account/inloggen?error=registered', request.url);
      if (next) login.searchParams.set('next', next);
      return redirect303(login);
    }
    cookies.set(SUPABASE_SESSION_COOKIE, result.accessToken, supabaseSessionCookieOptions());
    return redirect303(new URL(next || '/account', request.url));
  } catch (error) {
    const code = error instanceof Error && error.message === 'email_taken' ? 'email_taken' : error instanceof Error && error.message === 'configuration' ? 'configuration' : 'invalid';
    return redirect303(new URL(`/account/aanmaken?error=${code}`, request.url));
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
