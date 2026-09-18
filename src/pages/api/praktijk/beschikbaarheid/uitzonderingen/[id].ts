import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { deleteAvailabilityException } from '../../../../../lib/practiceStore';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals, params }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  try {
    deleteAvailabilityException(params.id || '', locals.currentUser!.practitionerId!, locals.currentUser!.sub);
    return new Response(null, { status: 303, headers: { location: '/praktijk/beschikbaarheid?exception_deleted=1' } });
  } catch {
    return new Response('Blokkade niet gevonden.', { status: 404 });
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
