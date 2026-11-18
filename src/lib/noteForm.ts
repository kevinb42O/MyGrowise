import {createPatientNote, getPatientByNote, savePatientNoteVersion, type PatientNote} from './clientRecords';
import {auditActor} from './securityAudit';
import type {UserSession} from './adminAuth';

/** Same-page fallback and enhanced submission share the same authorization and validation. */
export async function saveNoteForm(form: FormData, user: UserSession, patientId: string, recordsBase: string, requestId?: string) {
  const finalize = form.get('submit_status') === 'final';
  let noteId = String(form.get('note_id') || '');
  try {
    const actor = auditActor(user, requestId, `${recordsBase}/${patientId}`);
    if (form.get('operation') === 'save_note') {
      const note = await getPatientByNote(noteId, user);
      if (!note || note.patientId !== patientId) throw new Error('note_not_found');
      await savePatientNoteVersion({noteId, patientId, expectedVersion: Number(form.get('expected_version')), title: form.get('title'), body: form.get('body'), document: form.get('body_document'), finalize}, user, actor);
    } else {
      const type = String(form.get('note_type') || 'session');
      if (!['intake','session','follow_up','other','correction'].includes(type)) throw new Error('invalid_type');
      noteId = await createPatientNote({patientId, bookingId: String(form.get('booking_id') || '') || null, type: type as PatientNote['type'], occurredAt: String(form.get('occurred_at') || ''), title: form.get('title'), body: form.get('body'), document: form.get('body_document'), status: finalize ? 'final' : 'draft', correctsNoteId: String(form.get('corrects_note_id') || '') || null}, user, actor);
    }
    const query = new URLSearchParams({melding: finalize ? 'definitief' : 'concept'});
    query.set('onderdeel', 'verslagen');
    const page = Number(form.get('pagina'));
    if (Number.isSafeInteger(page) && page > 1) query.set('pagina', String(page));
    if (noteId) query.set('verslag', noteId);
    return {location: `${recordsBase}/${encodeURIComponent(patientId)}?${query}`, error: ''};
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    const error = code.includes('note_document') ? 'De tekstopmaak kon niet worden verwerkt. Je tekst blijft hier staan. Controleer de opmaak en probeer opnieuw.'
      : code.includes('version_conflict') ? 'Dit concept is intussen gewijzigd. Je tekst blijft hier staan. Open het dossier in een tweede tabblad om de nieuwste versie te vergelijken.'
      : code.includes('patient_archived') ? 'Dit dossier is gearchiveerd. Je tekst blijft hier staan. Vraag een beheerder om het dossier te herstellen.'
      : code.includes('booking_not_linked') ? 'Deze afspraak hoort niet bij dit dossier. Kies een andere afspraak of laat de koppeling leeg.'
      : code.includes('invalid_correction') ? 'De aanvulling moet verwijzen naar een definitief verslag in dit dossier.'
      : code.includes('note_locked') ? 'Dit concept kan niet meer worden bewerkt. Je tekst blijft hier staan; voeg zo nodig een aanvulling toe.'
      : 'Opslaan is niet gelukt. Je tekst blijft hier staan. Controleer de invoer en je toegang en probeer opnieuw.';
    return {location: '', error};
  }
}
