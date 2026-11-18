import {clientRecordError} from '../../../../lib/clientRecordErrors';
import { clientRecordsBaseForRequest } from '../../../../lib/clientRecordNavigation';
import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { createPatient, createPatientFromBooking, createPatientFromCustomerAccount } from '../../../../lib/clientRecords';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const recordsBase = clientRecordsBaseForRequest(request);
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData();
  const actor = auditActor(user, locals.requestId, '/api/admin/clienten');
  try {
    const operation = String(form.get('operation') || '');
    const patientId = operation === 'from_booking'
      ? await createPatientFromBooking(String(form.get('booking_id') || ''), user, actor)
      : operation === 'from_customer'
        ? await createPatientFromCustomerAccount(String(form.get('customer_user_id') || ''), String(form.get('assignee_user_id') || '') || null, user, actor)
        : await createPatient({ firstName: form.get('first_name'), lastName: form.get('last_name'), email: form.get('email'), assigneeUserId: form.get('assignee_user_id') }, user, actor);
    const destination = new URLSearchParams({ melding: operation === 'from_booking' ? 'afspraak' : operation === 'from_customer' ? 'account_gekoppeld' : 'aangemaakt' });
    if (operation === 'from_booking') destination.set('boeking', String(form.get('booking_id') || ''));
    return redirect(`${recordsBase}/${encodeURIComponent(patientId)}?${destination}${operation === 'from_booking' ? '#nieuw-verslag' : ''}`, 303);
  } catch (error) {
    const destination = new URLSearchParams({ fout: clientRecordError(error) });
    if (form.get('booking_id')) destination.set('boeking', String(form.get('booking_id')));
    return redirect(`${recordsBase}?${destination}${form.get('operation') === 'from_customer' ? '#client-account-create' : ''}`, 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
