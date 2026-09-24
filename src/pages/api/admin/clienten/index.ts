import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { createPatient, createPatientFromBooking } from '../../../../lib/clientRecords';

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
  return 'invalid_input';
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData();
  const actor = auditActor(user, locals.requestId, '/api/admin/clienten');
  try {
    const fromBooking = String(form.get('operation') || '') === 'from_booking';
    const patientId = fromBooking
      ? await createPatientFromBooking(String(form.get('booking_id') || ''), user, actor)
      : await createPatient({ fullName: form.get('full_name'), email: form.get('email'), assigneeUserId: form.get('assignee_user_id') }, user, actor);
    const destination = new URL(`/admin/clienten/${patientId}`, request.url);
    destination.searchParams.set('melding', fromBooking ? 'afspraak' : 'aangemaakt');
    return Response.redirect(destination, 303);
  } catch (error) {
    const destination = new URL('/admin/clienten', request.url);
    destination.searchParams.set('fout', friendlyError(error));
    return Response.redirect(destination, 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
