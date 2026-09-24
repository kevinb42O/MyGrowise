import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, isTrustedFormOrigin, registerSupabaseCustomer, sanitizeAppRedirect, supabaseSessionCookieOptions } from '../../../lib/adminAuth';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const password = String(form.get('password') || '');
  if (password !== String(form.get('confirm_password') || '')) return Response.redirect(new URL('/account/aanmaken?error=invalid', request.url), 303);
  try {
    const confirmationUrl = new URL('/account/inloggen?confirmed=1', request.url).toString();
    const result = await registerSupabaseCustomer(String(form.get('name') || ''), String(form.get('email') || '').trim().toLowerCase(), password, confirmationUrl);
    if (result.confirmationRequired) return Response.redirect(new URL('/account/inloggen?error=registered', request.url), 303);
    cookies.set(SUPABASE_SESSION_COOKIE, result.accessToken, supabaseSessionCookieOptions());
    return Response.redirect(new URL(sanitizeAppRedirect(form.get('next')) || '/account', request.url), 303);
  } catch (error) {
    const code = error instanceof Error && error.message === 'email_taken' ? 'email_taken' : error instanceof Error && error.message === 'configuration' ? 'configuration' : 'invalid';
    return Response.redirect(new URL(`/account/aanmaken?error=${code}`, request.url), 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
