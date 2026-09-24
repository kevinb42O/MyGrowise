import type { APIRoute } from 'astro';
import { createPracticeAgendaEvent, deletePracticeAgendaEvent, listAgendaEvents, updatePracticeAgendaEvent } from '../../../lib/adminAgenda';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { auditActor } from '../../../lib/securityAudit';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const isValidDate = (value: string | null) => Boolean(value && Number.isFinite(new Date(value).getTime()));

export const GET: APIRoute = async ({ url }) => {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!isValidDate(from) || !isValidDate(to) || new Date(to!).getTime() <= new Date(from!).getTime() || new Date(to!).getTime() - new Date(from!).getTime() > 62 * 86400000) return json({ error: 'Ongeldig datumbereik.' }, 400);
  try { return json({ events: await listAgendaEvents(from!, to!) }); }
  catch { return json({ error: 'Agenda kon niet worden geladen.' }, 502); }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  try {
    const body = await request.json();
    const event = await createPracticeAgendaEvent({ title: String(body.title || ''), startsAt: String(body.startsAt || ''), endsAt: String(body.endsAt || ''), kind: body.kind, location: String(body.location || ''), color: String(body.color || '#d26479') }, auditActor(locals.adminUser, locals.requestId, '/api/admin/agenda'));
    return json({ event }, 201);
  } catch (error) { return json({ error: error instanceof Error && error.message === 'invalid_event' ? 'Controleer titel, type en tijdstip.' : 'Opslaan is niet gelukt.' }, 400); }
};

export const DELETE: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  const id = url.searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Ongeldige afspraak.' }, 400);
  try { await deletePracticeAgendaEvent(id, auditActor(locals.adminUser, locals.requestId, '/api/admin/agenda')); return new Response(null, { status: 204 }); }
  catch { return json({ error: 'Verwijderen is niet gelukt.' }, 400); }
};

export const PATCH: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  const id = url.searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Ongeldige afspraak.' }, 400);
  try {
    const body = await request.json();
    const event = await updatePracticeAgendaEvent(id, { title: String(body.title || ''), startsAt: String(body.startsAt || ''), endsAt: String(body.endsAt || ''), kind: body.kind, location: String(body.location || ''), color: String(body.color || '#d26479') }, auditActor(locals.adminUser, locals.requestId, '/api/admin/agenda'));
    return json({ event });
  } catch (error) { return json({ error: error instanceof Error && error.message === 'invalid_event' ? 'Controleer titel, type en tijdstip.' : 'Opslaan is niet gelukt.' }, 400); }
};
