import {bookNewPatient} from '../../../lib/staffBooking';
import type { APIRoute } from 'astro';
import { listOffers } from '../../../lib/appointmentCatalog';
import { attemptAgendaBookingMail } from '../../../lib/bookingMail';
import { agendaClientChoices, agendaError, agendaInstant, agendaRange, agendaUuid } from '../../../lib/agendaData';
import { createOwnedAgendaEvent, deleteOwnedAgendaEvent, getPracticeAgendaAccess, listPracticeAgenda, updateOwnedAgendaEvent, type OwnedAgendaInput } from '../../../lib/practiceAgenda';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { createAvailabilityException, createStaffBooking, deleteAvailabilityException, rescheduleStaffBooking, updateBookingStatus, type BookingStatus } from '../../../lib/practiceStore';
import { auditActor, writeSecurityAudit } from '../../../lib/securityAudit';
import { getSupabaseAdmin } from '../../../lib/supabase/server';
import { ensurePracticeCalendarFresh } from '../../../lib/mijndiadSync';

export const prerender = false;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
});
const invalid = () => json({ error: 'Controleer de ingevulde gegevens.' }, 400);
const path = '/api/praktijk/agenda';

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.currentUser!;
  const practitionerId = user.practitionerId!;
  try {
    if (url.searchParams.get('clients') === '1') {
      const actor = auditActor(user, locals.requestId, path);
      await writeSecurityAudit({ actor, action: 'patient.directory_viewed', objectType: 'patient_directory', objectId: user.sub });
      return json(await agendaClientChoices(actor, url.searchParams));
    }
    if (url.searchParams.get('offers') === '1') {
      const offers = (await listOffers({ practitionerId })).filter(offer => offer.active)
        .map(({ id, name, duration, location, channel, practitionerId, practitionerName }) => ({ id, name, duration, channel, practitionerId, practitionerName, location: channel === 'online' ? 'Online' : location }));
      return json({ offers });
    }
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!agendaRange(from, to)) return invalid();
    const { canUseItransform } = await getPracticeAgendaAccess(practitionerId, user.sub);
    const state = canUseItransform ? await ensurePracticeCalendarFresh(practitionerId, { required: false, maxAgeSeconds: 60 }) : null;
    const result = await listPracticeAgenda(practitionerId, from!, to!, canUseItransform, user.sub, user.roles.includes('super_admin'));
    // A five-minute availability cache must not overrule the stricter source check.
    const sourceUnavailable = state !== null && !state.usable;
    return json({ ...result,
      events: sourceUnavailable ? result.events.filter(event => event.source !== 'availability') : result.events,
      availabilityUnknown: result.availabilityUnknown || sourceUnavailable,
      canUseItransform, sync: state?.sync ?? null,
    });
  } catch {
    return json({ error: 'De gevraagde agendagegevens konden niet worden geladen. Probeer opnieuw.' }, 502);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== 'string') return invalid();
  const user = locals.currentUser!;
  const practitionerId = user.practitionerId!;
  const actor = auditActor(user, locals.requestId, path);
  const id = String(body.id || '');
  const startsAt = String(body.startsAt || '');
  const endsAt = String(body.endsAt || '');
  const revision = body.revision;
  try {
    switch (body.action) {
      case 'sync': {
        const { canUseItransform } = await getPracticeAgendaAccess(practitionerId, user.sub);
        if (!canUseItransform) return json({ error: 'Geen toegang tot deze koppeling.' }, 403);
        const { data, error } = await getSupabaseAdmin().rpc('refresh_mijndiad_agenda');
        if (error || !data) return json({ error: 'MijnDiAd kon niet worden gecontroleerd. De vorige gegevens zijn behouden.' }, 503);
        return json(data);
      }
      case 'status': {
        const status = String(body.status || '') as BookingStatus;
        if (!agendaUuid.test(id) || !agendaInstant(revision) || !['confirmed', 'declined', 'cancelled', 'completed', 'no_show'].includes(status)) return invalid();
        await updateBookingStatus(id, practitionerId, user.sub, status, locals.requestId, path, revision);
        return json({ ok: true, id, mail: ['confirmed', 'cancelled'].includes(status) ? await attemptAgendaBookingMail(id) : null });
      }
      case 'manual': {
        const patientId = String(body.patientId || '');
        const offerId = String(body.offerId || '');
        if ((!body.newPatient && !agendaUuid.test(patientId)) || !agendaUuid.test(offerId) || !agendaInstant(startsAt)) return invalid();
        if (body.newPatient && !agendaUuid.test(String(body.newPatient.key || ''))) return invalid();
        const {data: selectedOffer,error: offerError}=await getSupabaseAdmin().from('practitioner_appointment_types').select('practitioner_id').eq('id',offerId).maybeSingle();
        if(offerError) throw offerError;
        if(selectedOffer?.practitioner_id!==practitionerId) return invalid();
        const bookingId = body.newPatient
          ? await bookNewPatient(user.sub,body.newPatient.key,String(body.newPatient.firstName||''),String(body.newPatient.lastName||''),String(body.newPatient.email||''),offerId,startsAt,String(body.newPatient.birthDate||''),locals.requestId)
          : await createStaffBooking(practitionerId, user.sub, patientId, startsAt, offerId, locals.requestId);
        return json({ ok: true, id: bookingId, mail: await attemptAgendaBookingMail(bookingId) }, 201);
      }
      case 'reschedule':
        if (!agendaUuid.test(id) || !agendaInstant(revision) || !agendaInstant(startsAt)) return invalid();
        await rescheduleStaffBooking(id, user.sub, startsAt, { practitionerId, revision, requestId: locals.requestId, requestPath: path });
        return json({ ok: true, id, mail: await attemptAgendaBookingMail(id) });
      case 'block':
        await createAvailabilityException(practitionerId, actor, startsAt, endsAt, String(body.reason || ''));
        return json({ ok: true }, 201);
      case 'unblock':
        if (!agendaUuid.test(id)) return invalid();
        await deleteAvailabilityException(id, practitionerId, actor);
        return json({ ok: true });
      case 'external_create':
      case 'external_update':
      case 'external_delete': {
        const { canUseItransform } = await getPracticeAgendaAccess(practitionerId, user.sub);
        if (body.action !== 'external_create' && (!agendaUuid.test(id) || !agendaInstant(revision))) return invalid();
        if (body.action === 'external_delete') {
          await deleteOwnedAgendaEvent(practitionerId, id, actor, revision);
          return json({ ok: true });
        }
        const input: OwnedAgendaInput = {
          title: String(body.title || ''), startsAt, endsAt, kind: body.kind,
          location: String(body.location || ''), color: String(body.color || ''), calendarScope: body.calendarScope || 'mygrowise',
        };
        const event = body.action === 'external_create'
          ? await createOwnedAgendaEvent(practitionerId, input, actor, canUseItransform)
          : await updateOwnedAgendaEvent(practitionerId, id, input, actor, canUseItransform, revision);
        return json({ event }, body.action === 'external_create' ? 201 : 200);
      }
      default:
        return invalid();
    }
  } catch (error) {
    const { status, message } = agendaError(error);
    return json({ error: message }, status);
  }
};
