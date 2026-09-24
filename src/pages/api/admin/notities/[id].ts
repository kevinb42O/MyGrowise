import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { getPatientByNote, savePatientNoteVersion } from '../../../../lib/clientRecords';

export const prerender = false;
export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const noteId = params.id || '';
  const requestedPage = Number(new URL(request.url).searchParams.get('pagina') || '1');
  const returnPage = Number.isSafeInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;
  let parentPatientId = '';
  try {
    const note = await getPatientByNote(noteId, user);
    if (!note) return new Response('Verslag niet gevonden.', { status: 404 });
    parentPatientId = note.patientId;
    const form = await request.formData();
    const finalize = String(form.get('submit_status') || 'draft') === 'final';
    const result = await savePatientNoteVersion({ noteId, patientId: note.patientId, expectedVersion: Number(form.get('expected_version')), title: form.get('title'), body: form.get('body'), finalize }, user, auditActor(user, locals.requestId, `/api/admin/notities/${noteId}`));
    const target = new URL(`/admin/clienten/${result.patientId}`, request.url);
    target.searchParams.set('melding', finalize ? 'definitief' : 'concept');
    if (returnPage > 1) target.searchParams.set('pagina', String(returnPage));
    return Response.redirect(target, 303);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const target = new URL(parentPatientId ? `/admin/clienten/${parentPatientId}` : '/admin/clienten', request.url);
    target.searchParams.set('fout', code.includes('version_conflict') ? 'versieconflict' : code.includes('patient_archived') ? 'dossier_gearchiveerd' : code.includes('not_found') ? 'dossier_niet_gevonden' : code.includes('note_locked') ? 'concept_niet_bewerkbaar' : 'verslag_niet_opgeslagen');
    if (parentPatientId && returnPage > 1) target.searchParams.set('pagina', String(returnPage));
    return Response.redirect(target, 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
