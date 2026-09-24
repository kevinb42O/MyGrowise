import type { APIRoute } from 'astro';
import { createPrivacyRequest, type RequestType } from '../../../../lib/adminPrivacy';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  const customerUserId = String(form.get('customer_user_id') || '');
  try {
    await createPrivacyRequest({ customerUserId, type: String(form.get('request_type') || '') as RequestType }, auditActor(locals.adminUser, locals.requestId, '/api/admin/privacy'));
    return Response.redirect(new URL(`/admin/klanten/${encodeURIComponent(customerUserId)}?privacy_request=created`, url), 303);
  } catch {
    return Response.redirect(new URL(`/admin/klanten/${encodeURIComponent(customerUserId)}?privacy_error=1`, url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
