import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { linkPatientCustomerAccount } from '../../../../../lib/clientRecords';
import { auditActor } from '../../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const patientId = params.id || '';
  try {
    const form = await request.formData();
    await linkPatientCustomerAccount(patientId, String(form.get('customer_user_id') || ''), locals.currentUser!,
      auditActor(locals.currentUser!, locals.requestId, `/api/admin/clienten/${patientId}/account`));
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?melding=account_gekoppeld`, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = message.includes('patient_account_mismatch') ? 'account_komt_niet_overeen'
      : message.includes('patient_account_already_linked') ? 'klantaccount_al_gekoppeld'
        : message.includes('patient_archived') ? 'dossier_gearchiveerd' : 'account_koppelen_mislukt';
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?fout=${code}`, 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
