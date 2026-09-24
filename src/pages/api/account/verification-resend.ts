import type { APIRoute } from 'astro';
import { isTrustedFormOrigin, resendSupabaseCustomerConfirmation } from '../../../lib/adminAuth';

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!email || email.length > 254) return Response.redirect(new URL('/account/inloggen?error=verification_sent', request.url), 303);

  try {
    const confirmationUrl = new URL('/account/inloggen?confirmed=1', request.url).toString();
    await resendSupabaseCustomerConfirmation(email, confirmationUrl);
  } catch {
    // Keep the response generic so the route does not reveal whether an account exists.
  }
  return Response.redirect(new URL('/account/inloggen?error=verification_sent', request.url), 303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
