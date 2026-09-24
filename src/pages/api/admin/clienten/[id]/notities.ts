import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { auditActor } from '../../../../../lib/securityAudit';
import { createPatientNote, type PatientNote } from '../../../../../lib/clientRecords';

export const prerender = false;
const noteTypes = ['intake', 'session', 'follow_up', 'other', 'correction'] as const;
const destinationFor = (patientId: string, code: string) => `/admin/clienten/${encodeURIComponent(patientId)}?${new URLSearchParams({ melding: code })}`;

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData(); const patientId = params.id || '';
  const requestedType = String(form.get('note_type') || 'session');
  if (!noteTypes.includes(requestedType as typeof noteTypes[number])) return redirect(destinationFor(patientId, 'ongeldige_invoer'), 303);
  const finalize = String(form.get('submit_status') || 'draft') === 'final';
  try {
    await createPatientNote({
      patientId,
      bookingId: String(form.get('booking_id') || '') || null,
      type: requestedType as PatientNote['type'],
      occurredAt: String(form.get('occurred_at') || ''),
      title: form.get('title'), body: form.get('body'),
      status: finalize ? 'final' : 'draft',
      correctsNoteId: String(form.get('corrects_note_id') || '') || null,
    }, user, auditActor(user, locals.requestId, `/api/admin/clienten/${patientId}/notities`));
    return redirect(destinationFor(patientId, finalize ? 'definitief' : 'concept'), 303);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const message = code.includes('not_found') ? 'dossier_niet_gevonden' : code.includes('patient_archived') ? 'dossier_gearchiveerd' : code.includes('booking_not_linked') ? 'afspraak_niet_gekoppeld' : code.includes('invalid_correction') ? 'correctie_niet_geldig' : 'ongeldige_invoer';
    return redirect(destinationFor(patientId, message), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
