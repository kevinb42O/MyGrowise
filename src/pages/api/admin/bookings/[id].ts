import type { APIRoute } from 'astro';
import { updateAdminBookingStatus } from '../../../../lib/superAdmin';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  try {
    await updateAdminBookingStatus(params.id || '', String(form.get('status') || ''), auditActor(locals.adminUser, locals.requestId, `/api/admin/bookings/${params.id || ''}`));
    return Response.redirect(new URL('/admin/boekingen?message=updated', url), 303);
  } catch (error) {
    const code = error instanceof Error && error.message === 'invalid_transition' ? 'invalid_transition' : 'update_failed';
    return Response.redirect(new URL(`/admin/boekingen?error=${code}`, url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
