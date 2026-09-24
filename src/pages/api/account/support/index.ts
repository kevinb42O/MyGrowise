import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { createSupportConversation } from '../../../../lib/supportInbox';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  try { const id = await createSupportConversation({ customerId: locals.currentUser!.sub, subject: form.get('subject'), category: form.get('category'), body: form.get('body') }, auditActor(locals.currentUser, locals.requestId, '/api/account/support')); return Response.redirect(new URL(`/account/ondersteuning?conversation=${id}&created=1`, url), 303); }
  catch { return Response.redirect(new URL('/account/ondersteuning?error=invalid', url), 303); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
