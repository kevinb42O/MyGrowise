import type { APIRoute } from 'astro';
import { sendInternalMessage } from '../../../../lib/internalMessaging';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;
const basePath = (value: FormDataEntryValue | null) => value === 'practice' ? '/praktijk/berichten' : '/admin/berichten';

export const POST: APIRoute = async ({ request, params, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const base = basePath(form.get('surface')); const id = params.id || '';
  try {
    await sendInternalMessage({ threadId: id, senderId: locals.currentUser?.sub || '', body: form.get('body') }, auditActor(locals.currentUser, locals.requestId, `/api/internal/messages/${id}`));
    return Response.redirect(new URL(`${base}?thread=${encodeURIComponent(id)}&sent=1`, url), 303);
  } catch {
    return Response.redirect(new URL(`${base}?thread=${encodeURIComponent(id)}&error=${encodeURIComponent('Bericht kon niet worden verstuurd.')}`, url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
