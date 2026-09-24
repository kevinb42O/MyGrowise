import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { markCustomerBookingNotificationRead } from '../../../../../lib/supabase/accounts';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  try {
    const bookingId = await markCustomerBookingNotificationRead(params.id || '', locals.currentUser!.sub);
    return Response.redirect(new URL(`/account/begeleiding#booking-${bookingId}`, request.url), 303);
  } catch {
    return Response.redirect(new URL('/account/notificaties?error=1', request.url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
