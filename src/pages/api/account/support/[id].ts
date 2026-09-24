import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { sendSupportMessage } from '../../../../lib/supportInbox';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals, params, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = params.id || ''; const form = await request.formData();
  try { await sendSupportMessage({ conversationId: id, senderId: locals.currentUser!.sub, body: form.get('body'), staff: false }, auditActor(locals.currentUser, locals.requestId, `/api/account/support/${id}`)); return Response.redirect(new URL(`/account/ondersteuning?conversation=${id}&sent=1`, url), 303); }
  catch { return Response.redirect(new URL(`/account/ondersteuning?conversation=${id}&error=invalid`, url), 303); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
