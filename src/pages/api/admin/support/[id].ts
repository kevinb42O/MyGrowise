import type { APIRoute } from 'astro';
import { hasPermission, hasRole, isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { sendSupportMessage, updateSupportConversation } from '../../../../lib/supportInbox';
import { deliverSupportMail } from '../../../../lib/supportMail';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals, params, url }) => {
  if (!isTrustedFormOrigin(request) || !hasPermission(locals.adminUser, 'support.write')) return new Response('Geen toegang.', { status: 403 });
  const id = params.id || ''; const form = await request.formData(); const action = String(form.get('action') || '');
  const basePath = form.get('return_to') === 'practice' && hasRole(locals.currentUser, 'practitioner') && locals.currentUser?.practitionerId ? '/praktijk/berichten' : '/admin/berichten';
  try {
    if (action === 'message' || action === 'note') { await sendSupportMessage({ conversationId: id, senderId: locals.currentUser!.sub, body: form.get('body'), internal: action === 'note', staff: true }, auditActor(locals.currentUser, locals.requestId, `/api/admin/support/${id}`)); if (action === 'message') { try { await deliverSupportMail(5); } catch { /* Durable job remains in queue. */ } } }
    else if (action === 'update') await updateSupportConversation(id, { status: form.get('status'), priority: form.get('priority'), assignedTo: form.get('assigned_to') }, auditActor(locals.currentUser, locals.requestId, `/api/admin/support/${id}`));
    else throw new Error('invalid');
    return Response.redirect(new URL(`${basePath}?conversation=${id}&updated=1`, url), 303);
  } catch { return Response.redirect(new URL(`${basePath}?conversation=${id}&error=invalid`, url), 303); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
