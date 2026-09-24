import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { updateBookingStatus, type BookingStatus } from '../../../../lib/practiceStore';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals, params }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!;
  const form = await request.formData();
  const status = String(form.get('status') || '') as BookingStatus;
  try {
    await updateBookingStatus(params.id || '', user.practitionerId!, user.sub, status);
    return new Response(null, { status: 303, headers: { location: '/praktijk/boekingen?updated=1' } });
  } catch (error) {
    const code = error instanceof Error && error.message === 'not_found' ? 404 : 409;
    return new Response(code === 404 ? 'Boeking niet gevonden.' : 'Deze statuswijziging is niet toegestaan.', { status: code });
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
