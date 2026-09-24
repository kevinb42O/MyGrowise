import type { APIRoute } from 'astro';
import { createInternalThread } from '../../../../lib/internalMessaging';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;
const basePath = (value: FormDataEntryValue | null) => value === 'practice' ? '/praktijk/berichten' : '/admin/berichten';

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const base = basePath(form.get('surface'));
  try {
    const threadId = await createInternalThread({ subject: form.get('subject'), body: form.get('body'), recipientIds: form.getAll('recipient_ids').map(String), senderId: locals.currentUser?.sub || '' }, auditActor(locals.currentUser, locals.requestId, '/api/internal/messages'));
    return Response.redirect(new URL(`${base}?thread=${encodeURIComponent(threadId)}&created=1`, url), 303);
  } catch (error) {
    const message = error instanceof Error && error.message === 'invalid_recipient' ? 'Een ontvanger is niet beschikbaar.' : 'Vul een onderwerp, ontvanger en bericht in.';
    return Response.redirect(new URL(`${base}?error=${encodeURIComponent(message)}`, url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
