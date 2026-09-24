import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { auditActor } from '../../../../../lib/securityAudit';
import { archivePatient } from '../../../../../lib/clientRecords';

export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const patientId = params.id || ''; const form = await request.formData();
  const archived = String(form.get('operation') || 'archive') !== 'restore';
  try {
    await archivePatient(patientId, user, auditActor(user, locals.requestId, `/api/admin/clienten/${patientId}/archiveren`), archived);
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?melding=${archived ? 'gearchiveerd' : 'hersteld'}`, 303);
  } catch {
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?fout=archiveren_mislukt`, 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
