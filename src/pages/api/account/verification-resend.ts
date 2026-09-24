import type { APIRoute } from 'astro';
import { isTrustedFormOrigin, resendSupabaseCustomerConfirmation, sanitizeAppRedirect } from '../../../lib/adminAuth';

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const next = sanitizeAppRedirect(form.get('next'));
  const response = new URL('/account/inloggen?error=verification_sent', request.url);
  if (next) response.searchParams.set('next', next);
  if (!email || email.length > 254) return Response.redirect(response, 303);

  try {
    const confirmation = new URL('/account/inloggen?confirmed=1', request.url);
    if (next) confirmation.searchParams.set('next', next);
    const confirmationUrl = confirmation.toString();
    await resendSupabaseCustomerConfirmation(email, confirmationUrl);
  } catch {
    // Keep the response generic so the route does not reveal whether an account exists.
  }
  const destination = next.startsWith('/begeleiding/')
    ? new URL(`${next}?verification_sent=1`, request.url)
    : response;
  return Response.redirect(destination, 303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
