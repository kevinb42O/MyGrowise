import { getSupabaseAdmin } from './supabase/server';
import { ensurePracticeCalendarFresh } from './mijndiadSync';

export async function bookNewPatient(actor: string, key: string, firstName: string, lastName: string, email: string, offer: string, starts: string, birthDate: string, requestId?: string) {
  const db = getSupabaseAdmin();
  const { data: type, error: offerError } = await db.from('practitioner_appointment_types').select('practitioner_id').eq('id', offer).single();
  if (offerError) throw offerError;
  await ensurePracticeCalendarFresh(type.practitioner_id, { maxAgeSeconds: 60 });
  const { data, error } = await db.rpc('book_new_patient_with_names', { p_actor: actor, p_key: key, p_first_name: firstName, p_last_name: lastName, p_email: email, p_offer: offer, p_starts: starts, p_birth_date: birthDate, p_request: requestId || null });
  if (error) throw error;
  return String(data);
}

export async function registerBookingOutcome(actor: string, id: string, revision: string, status: string, category = 'unknown', billing = 'unreviewed', requestId?: string) {
  const { error } = await getSupabaseAdmin().rpc('register_booking_outcome', {
    p_actor: actor, p_booking: id, p_revision: revision, p_status: status, p_category: category, p_billing: billing, p_request: requestId || null,
  });
  if (error) throw error;
}
