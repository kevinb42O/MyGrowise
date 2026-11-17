import type { APIRoute } from 'astro';
import { createPracticeAgendaEvent, deletePracticeAgendaEvent, listAgendaEvents, listAgendaPractitioners, movePracticeAgendaEvent, updatePracticeAgendaEvent } from '../../../lib/adminAgenda';
import { agendaClientChoices, agendaError, agendaInstant, agendaRange, agendaUuid } from '../../../lib/agendaData';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { auditActor, writeSecurityAudit } from '../../../lib/securityAudit';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } });
const invalid = () => json({ error: 'Controleer de ingevulde gegevens.' }, 400);
const failure = (error: unknown) => {
  const { status, message } = agendaError(error);
  return json({ error: message }, status);
};

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    if (url.searchParams.get('clients') === '1') {
      const actor = auditActor(locals.adminUser, locals.requestId, url.pathname);
      await writeSecurityAudit({ actor, action: 'patient.directory_viewed', objectType: 'patient_directory', objectId: actor.userId });
      return json(await agendaClientChoices(actor, url.searchParams));
    }
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const practitioner = url.searchParams.get('practitioner') || undefined;
    if (!agendaRange(from, to) || (practitioner && !agendaUuid.test(practitioner))) return invalid();
    const [events, practitioners] = await Promise.all([
      listAgendaEvents(from!, to!, practitioner, locals.adminUser?.practitionerId || undefined),
      listAgendaPractitioners(),
    ]);
    return json({ events, practitioners });
  } catch {
    return json({ error: 'Agenda kon niet worden geladen.' }, 502);
  }
};

const readEvent = (body: Record<string, unknown>) => ({
  title: String(body.title || ''), startsAt: String(body.startsAt || ''), endsAt: String(body.endsAt || ''),
  kind: body.kind as 'appointment' | 'personal' | 'block', location: String(body.location || ''),
  color: String(body.color || '#1f7060'), practitionerId: body.practitionerId ? String(body.practitionerId) : null,
  calendarScope: 'mygrowise' as const,
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || (body.calendarScope !== undefined && body.calendarScope !== 'mygrowise')) return invalid();
  try {
    const event = await createPracticeAgendaEvent(readEvent(body), auditActor(locals.adminUser, locals.requestId, '/api/admin/agenda'));
    return json({ event }, 201);
  } catch (error) { return failure(error); }
};

export const PATCH: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  const id = url.searchParams.get('id') || '';
  const body = await request.json().catch(() => null);
  if (!agendaUuid.test(id) || !body || !agendaInstant(body.revision) ||
    (body.calendarScope !== undefined && body.calendarScope !== 'mygrowise')) return invalid();
  const actor = auditActor(locals.adminUser, locals.requestId, '/api/admin/agenda');
  try {
    const event = body.action === 'move'
      ? await movePracticeAgendaEvent(id, body.startsAt, body.endsAt, actor, body.revision)
      : await updatePracticeAgendaEvent(id, readEvent(body), actor, body.revision);
    return json({ event });
  } catch (error) { return failure(error); }
};

export const DELETE: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  const id = url.searchParams.get('id') || '';
  const revision = url.searchParams.get('revision');
  if (!agendaUuid.test(id) || !agendaInstant(revision)) return invalid();
  try {
    await deletePracticeAgendaEvent(id, auditActor(locals.adminUser, locals.requestId, '/api/admin/agenda'), revision);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error); }
};
