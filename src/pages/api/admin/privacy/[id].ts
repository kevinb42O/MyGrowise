import type { APIRoute } from 'astro';
import { updatePrivacyRequestStatus, type RequestStatus } from '../../../../lib/adminPrivacy';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  try {
    await updatePrivacyRequestStatus(params.id || '', String(form.get('status') || '') as RequestStatus, auditActor(locals.adminUser, locals.requestId, `/api/admin/privacy/${params.id || ''}`));
    return Response.redirect(new URL('/admin/privacy?message=updated', url), 303);
  } catch {
    return Response.redirect(new URL('/admin/privacy?error=update_failed', url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
