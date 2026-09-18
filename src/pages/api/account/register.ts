import type { APIRoute } from 'astro';
import { CUSTOMER_COOKIE, adminCookieOptions, createPasswordCredential, createUserSession, isAdminAuthConfigured, isTrustedFormOrigin } from '../../../lib/adminAuth';
import { createCustomerAccount } from '../../../lib/practiceDb';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  if (!isAdminAuthConfigured()) return Response.redirect(new URL('/account/aanmaken?error=configuration', request.url), 303);
  const form = await request.formData(); const password = String(form.get('password') || '');
  if (password !== String(form.get('confirm_password') || '')) return Response.redirect(new URL('/account/aanmaken?error=invalid', request.url), 303);
  try {
    const credential = createPasswordCredential(password);
    const user = createCustomerAccount({ name: String(form.get('name') || ''), email: String(form.get('email') || ''), passwordSalt: credential.salt, passwordHash: credential.hash });
    cookies.set(CUSTOMER_COOKIE, createUserSession(user), adminCookieOptions());
    return Response.redirect(new URL('/account', request.url), 303);
  } catch (error) {
    const code = error instanceof Error && error.message === 'email_taken' ? 'email_taken' : 'invalid';
    return Response.redirect(new URL(`/account/aanmaken?error=${code}`, request.url), 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
