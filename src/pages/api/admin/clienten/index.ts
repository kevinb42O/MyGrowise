import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { createPatient, createPatientFromBooking, createPatientFromCustomerAccount } from '../../../../lib/clientRecords';

export const prerender = false;

const errorCode = (error: unknown) => error instanceof Error ? error.message : '';
const friendlyError = (error: unknown) => {
  const code = errorCode(error);
  if (code.includes('booking_not_ready')) return 'booking_not_ready';
  if (code.includes('booking_already_linked')) return 'booking_already_linked';
  if (code.includes('booking_patient_mismatch')) return 'booking_patient_mismatch';
  if (code.includes('patient_archived')) return 'patient_archived';
  if (code.includes('not_found')) return 'not_found';
  if (code.includes('not_allowed')) return 'not_allowed';
  if (code.includes('invalid_patient')) return 'invalid_patient';
  if (code.includes('potential_patient_match')) return 'potential_patient_match';
  if (code.includes('customer_not_found')) return 'customer_not_found';
  if (code.includes('invalid_assignee')) return 'invalid_assignee';
  return 'invalid_input';
};

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData();
  const actor = auditActor(user, locals.requestId, '/api/admin/clienten');
  try {
    const operation = String(form.get('operation') || '');
    const patientId = operation === 'from_booking'
      ? await createPatientFromBooking(String(form.get('booking_id') || ''), user, actor)
      : operation === 'from_customer'
        ? await createPatientFromCustomerAccount(String(form.get('customer_user_id') || ''), String(form.get('assignee_user_id') || '') || null, user, actor)
        : await createPatient({ fullName: form.get('full_name'), email: form.get('email'), assigneeUserId: form.get('assignee_user_id') }, user, actor);
    const destination = new URLSearchParams({ melding: operation === 'from_booking' ? 'afspraak' : operation === 'from_customer' ? 'account_gekoppeld' : 'aangemaakt' });
    return redirect(`/admin/clienten/${encodeURIComponent(patientId)}?${destination}`, 303);
  } catch (error) {
    const destination = new URLSearchParams({ fout: friendlyError(error) });
    return redirect(`/admin/clienten?${destination}`, 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
