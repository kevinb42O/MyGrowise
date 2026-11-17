import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { createAvailabilityException } from '../../../../lib/practiceStore';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  const startsAt = String(form.get('starts_at') || '');
  const endsAt = String(form.get('ends_at') || '');
  const reason = String(form.get('reason') || '');
  try {
    await createAvailabilityException(locals.currentUser!.practitionerId!, auditActor(locals.currentUser, locals.requestId, new URL(request.url).pathname), startsAt, endsAt, reason);
    return new Response(null, { status: 303, headers: { location: '/praktijk/beschikbaarheid?exception_saved=1' } });
  } catch {
    return new Response(null, { status: 303, headers: { location: '/praktijk/beschikbaarheid?exception_error=1' } });
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
