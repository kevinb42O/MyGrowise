import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { auditActor } from '../../../../../lib/securityAudit';
import { linkPatientBooking } from '../../../../../lib/clientRecords';

export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const patientId = params.id || ''; const form = await request.formData();
  try {
    await linkPatientBooking(patientId, String(form.get('booking_id') || ''), user, auditActor(user, locals.requestId, `/api/admin/clienten/${patientId}/afspraken`));
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?melding=afspraak_gekoppeld`, 303);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const errorCode = code.includes('booking_already_linked') ? 'afspraak_al_gekoppeld' : code.includes('patient_account_already_linked') ? 'klantaccount_al_gekoppeld' : code.includes('booking_patient_mismatch') ? 'afspraak_klopt_niet' : code.includes('patient_archived') ? 'dossier_gearchiveerd' : 'afspraak_koppelen_mislukt';
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?fout=${errorCode}`, 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
