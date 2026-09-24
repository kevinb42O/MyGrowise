import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { auditActor } from '../../../../../lib/securityAudit';
import { changePatientAssignment } from '../../../../../lib/clientRecords';

export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const patientId = params.id || ''; const form = await request.formData();
  const assign = String(form.get('operation') || '') === 'assign';
  try {
    await changePatientAssignment({ patientId, assigneeUserId: String(form.get('user_id') || ''), assign }, user, auditActor(user, locals.requestId, `/api/admin/clienten/${patientId}/toewijzingen`));
    const target = new URL(`/admin/clienten/${patientId}`, request.url); target.searchParams.set('melding', assign ? 'toegewezen' : 'toewijzing_beeindigd');
    return Response.redirect(target, 303);
  } catch {
    const target = new URL(`/admin/clienten/${patientId}`, request.url); target.searchParams.set('fout', 'toewijzing_mislukt');
    return Response.redirect(target, 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
