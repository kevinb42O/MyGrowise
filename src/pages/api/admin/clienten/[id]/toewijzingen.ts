import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { auditActor } from '../../../../../lib/securityAudit';
import { changePatientAssignment } from '../../../../../lib/clientRecords';

export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const patientId = params.id || ''; const form = await request.formData();
  const assign = String(form.get('operation') || '') === 'assign';
  try {
    await changePatientAssignment({ patientId, assigneeUserId: String(form.get('user_id') || ''), assign }, user, auditActor(user, locals.requestId, `/api/admin/clienten/${patientId}/toewijzingen`));
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?melding=${assign ? 'toegewezen' : 'toewijzing_beeindigd'}`, 303);
  } catch {
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?fout=toewijzing_mislukt`, 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
