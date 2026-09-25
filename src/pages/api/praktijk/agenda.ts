import type { APIRoute } from 'astro';
import { createOwnedAgendaEvent, deleteOwnedAgendaEvent, getPracticeAgendaAccess, listPracticeAgenda, updateOwnedAgendaEvent, type OwnedAgendaInput } from '../../../lib/practiceAgenda';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { createAvailabilityException, createStaffBooking, deleteAvailabilityException, rescheduleStaffBooking, updateBookingStatus, type BookingStatus } from '../../../lib/practiceStore';
import { auditPatientDirectoryAccess, listPatientRecords } from '../../../lib/clientRecords';
import { auditActor } from '../../../lib/securityAudit';

export const prerender = false;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const validRange = (from: string | null, to: string | null) => {
  const start = Date.parse(from || ''); const end = Date.parse(to || '');
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 62 * 86400000;
};

export const GET: APIRoute = async ({ url, locals }) => {
  if (url.searchParams.get('clients') === '1') {
    try {
      await auditPatientDirectoryAccess(locals.currentUser!, locals.requestId);
      const patients = await listPatientRecords(locals.currentUser!, '', 'active');
      return json({ clients: patients.map((patient) => ({ id: patient.id, name: patient.fullName, email: patient.email }))
        .filter((patient) => patient.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) });
    } catch { return json({ error: 'Cliënten konden niet worden geladen.' }, 502); }
  }
  const from = url.searchParams.get('from'); const to = url.searchParams.get('to');
  if (!validRange(from, to)) return json({ error: 'Ongeldig datumbereik.' }, 400);
  try {
    const user = locals.currentUser!;
    const { canUseItransform } = await getPracticeAgendaAccess(user.practitionerId!, user.sub);
    return json({ events: await listPracticeAgenda(user.practitionerId!, from!, to!, canUseItransform), canUseItransform });
  }
  catch { return json({ error: 'Agenda kon niet worden geladen.' }, 502); }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Ongeldige aanvraag.' }, 400); }
  const user = locals.currentUser!;
  try {
    if (body.action === 'status') {
      const status = String(body.status || '') as BookingStatus;
      if (!['confirmed', 'declined', 'cancelled', 'completed', 'no_show'].includes(status)) return json({ error: 'Ongeldige status.' }, 400);
      await updateBookingStatus(String(body.id || ''), user.practitionerId!, user.sub, status, locals.requestId, '/api/praktijk/agenda');
      return json({ ok: true });
    }
    if (body.action === 'block') {
      const startsAt = String(body.startsAt || ''); const endsAt = String(body.endsAt || '');
      const reason = String(body.reason || '');
      await createAvailabilityException(user.practitionerId!, user.sub, startsAt, endsAt, reason);
      return json({ ok: true }, 201);
    }
    if (body.action === 'manual') {
      const id = await createStaffBooking(user.practitionerId!, user.sub, String(body.patientId || ''), String(body.startsAt || ''), String(body.endsAt || ''), locals.requestId);
      return json({ ok: true, id }, 201);
    }
    if (body.action === 'reschedule') {
      await rescheduleStaffBooking(String(body.id || ''), user.sub, String(body.startsAt || ''), String(body.endsAt || ''), locals.requestId);
      return json({ ok: true });
    }
    if (['external_create', 'external_update', 'external_delete'].includes(String(body.action))) {
      const actor = auditActor(user, locals.requestId, '/api/praktijk/agenda');
      const { canUseItransform } = await getPracticeAgendaAccess(user.practitionerId!, user.sub);
      const id = String(body.id || '');
      if (body.action !== 'external_create' && !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Ongeldig moment.' }, 400);
      if (body.action === 'external_delete') {
        await deleteOwnedAgendaEvent(user.practitionerId!, id, actor, canUseItransform);
        return json({ ok: true });
      }
      const input: OwnedAgendaInput = {
        title: String(body.title || ''), startsAt: String(body.startsAt || ''), endsAt: String(body.endsAt || ''),
        kind: body.kind as OwnedAgendaInput['kind'], location: String(body.location || ''), color: String(body.color || ''),
        calendarScope: String(body.calendarScope || 'mygrowise') as OwnedAgendaInput['calendarScope'],
      };
      if (body.action === 'external_create') {
        const createdId = await createOwnedAgendaEvent(user.practitionerId!, input, actor, canUseItransform);
        return json({ ok: true, id: createdId }, 201);
      }
      await updateOwnedAgendaEvent(user.practitionerId!, id, input, actor, canUseItransform);
      return json({ ok: true });
    }
    if (body.action === 'unblock') {
      await deleteAvailabilityException(String(body.id || ''), user.practitionerId!, user.sub);
      return json({ ok: true });
    }
    return json({ error: 'Onbekende actie.' }, 400);
  } catch (error) {
    const code = error && typeof error === 'object'
      ? String((error as { code?: string; message?: string }).code || (error as { message?: string }).message || '') : '';
    if (code === 'not_found' || code === 'not_allowed') return json({ error: 'Geen toegang tot dit item.' }, 403);
    if (code === 'invalid_transition' || code === 'slot_unavailable') return json({ error: code === 'slot_unavailable' ? 'Dit tijdstip is intussen bezet.' : 'Deze statuswijziging is niet toegestaan.' }, 409);
    if (code === 'invalid_input') return json({ error: 'Controleer cliënt en tijdstip.' }, 400);
    if (code === 'invalid_event') return json({ error: 'Controleer titel, type en tijdstip.' }, 400);
    if (code === '23P01') return json({ error: 'Dit moment overlapt met een andere afspraak of blokkade.' }, 409);
    return json({ error: 'Opslaan is niet gelukt. Controleer het tijdstip en probeer opnieuw.' }, 400);
  }
};
