import { getSupabaseAdmin } from './supabase/server';
import { agendaEventValues, agendaRows, calendarBookingStatuses, writeAgendaItem } from './agendaData';
import type { AuditActor } from './securityAudit';

export type CalendarScope = 'mygrowise' | 'itransform';

export const getPracticeAgendaAccess = async (practitionerId: string, userId: string) => {
  const { data, error } = await getSupabaseAdmin().from('practitioners')
    .select('slug').eq('id', practitionerId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('not_allowed');
  return { canUseItransform: data.slug === 'virginie' };
};

export type PracticeAgendaItem = {
  id: string;
  source: 'mygrowise' | 'itransform' | 'block' | 'availability';
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string;
  status: string;
  kind: 'appointment' | 'personal' | 'block' | 'availability';
  location: string;
  color: string;
  editable: boolean;
  patientId?: string | null;
  externalSource?: 'mijndiad' | null;
  externalUrl?: string | null;
  revision?: string;
  conflict?: boolean;
  offerIds?: string[];
};

export const listPracticeAgenda = async (practitionerId: string, from: string, to: string, canUseItransform: boolean, actorId?: string, canReadAllPatients = false) => {
  const client = getSupabaseAdmin();
  const [bookings, exceptions, moments, availability, assignments] = await Promise.all([
    agendaRows<any>(client.from('bookings')
      .select('id,patient_id,client_name,appointment_name,offer:practitioner_appointment_types(appointment_types(treatment_groups(color))),starts_at,ends_at,updated_at,status,location,channel')
      .eq('practitioner_id', practitionerId).in('status', calendarBookingStatuses).lt('starts_at', to).gt('ends_at', from).order('starts_at').order('id')),
    agendaRows<any>(client.from('availability_exceptions').select('id,starts_at,ends_at,private_reason')
      .eq('practitioner_id', practitionerId).eq('kind', 'unavailable').lt('starts_at', to).gt('ends_at', from).order('starts_at').order('id')),
    agendaRows<any>(client.from('practice_calendar_events')
      .select('id,title,starts_at,ends_at,event_kind,location,color,calendar_scope,external_source,external_url,updated_at')
      .eq('practitioner_id', practitionerId).in('calendar_scope', canUseItransform ? ['mygrowise', 'itransform'] : ['mygrowise']).eq('status', 'confirmed')
      .lt('starts_at', to).gt('ends_at', from).order('starts_at').order('id')),
    agendaRows<{ offer_id: string; offer_name: string; slots: [string, string][] }>(client.rpc('agenda_offer_availability', { p_practitioner: practitionerId, p_from: from, p_to: to })
      .order('slot_day').order('offer_id')).catch(() => null),
    actorId && !canReadAllPatients ? agendaRows<{ patient_id: string }>(client.from('patient_assignments')
      .select('patient_id').eq('user_id', actorId).is('ended_at', null).order('patient_id')) : Promise.resolve([]),
  ]);

  const assignedPatients = new Set(assignments.map(row => row.patient_id));
  const appointments: PracticeAgendaItem[] = bookings.map(row => ({
    id: row.id, source: 'mygrowise', title: row.client_name, subtitle: row.appointment_name, startsAt: row.starts_at, endsAt: row.ends_at,
    status: row.status, kind: 'appointment', location: row.channel === 'online' ? 'Online' : row.location || '',
    color: row.offer?.appointment_types?.treatment_groups?.color || '#1f7060', editable: false, patientId: canReadAllPatients || assignedPatients.has(row.patient_id) ? row.patient_id : null, revision: row.updated_at,
  }));
  const blocks: PracticeAgendaItem[] = exceptions.map(row => ({
    id: row.id, source: 'block', title: 'Niet beschikbaar', subtitle: row.private_reason || 'Privéblokkade', startsAt: row.starts_at, endsAt: row.ends_at,
    status: 'confirmed', kind: 'block', location: '', color: '#687985', editable: false,
  }));
  const customEvents: PracticeAgendaItem[] = moments.map(row => ({
    id: row.id, source: row.calendar_scope, title: row.title, subtitle: row.external_source === 'mijndiad' ? 'MijnDiAd' : row.location || '',
    startsAt: row.starts_at, endsAt: row.ends_at, status: 'confirmed', kind: row.event_kind, location: row.location || '',
    color: row.color || '#d26479', editable: !row.external_source, revision: row.updated_at, externalSource: row.external_source,
    externalUrl: row.external_source === 'mijndiad' && /^https:\/\/praktijkitransform\.mijndiad\.nl\/appointments\/\d+$/.test(row.external_url || '') ? row.external_url : null,
  }));
  const scheduled = [...appointments.filter(item => ['pending', 'confirmed'].includes(item.status)), ...blocks, ...customEvents.filter(item => !item.externalSource)];
  const imported = customEvents.filter(item => item.externalSource === 'mijndiad');
  for (const external of imported) {
    const matches = scheduled.filter(item => Date.parse(item.startsAt) < Date.parse(external.endsAt) && Date.parse(item.endsAt) > Date.parse(external.startsAt));
    if (matches.length) external.conflict = true;
    for (const item of matches) item.conflict = true;
  }
  const available: PracticeAgendaItem[] = (availability || []).flatMap(row => row.slots.map(([startsAt, endsAt]) => ({
    id: `${row.offer_id}/${startsAt}`, source: 'availability', title: row.offer_name, subtitle: '',
    startsAt, endsAt, status: 'available', kind: 'availability', location: '',
    color: '#a1d1b0', editable: false, offerIds: [row.offer_id],
  })));
  return { events: [...available, ...blocks, ...customEvents, ...appointments], availabilityUnknown: availability === null };
};

export type OwnedAgendaInput = {
  title: string; startsAt: string; endsAt: string;
  kind: 'appointment' | 'personal' | 'block'; location: string; color: string; calendarScope: CalendarScope;
};

const ownedValues = (input: OwnedAgendaInput, canUseItransform: boolean) => {
  if (input.calendarScope === 'itransform' && !canUseItransform) throw new Error('not_allowed');
  if (!['mygrowise', 'itransform'].includes(input.calendarScope)) throw new Error('invalid_event');
  return agendaEventValues(input);
};

export const createOwnedAgendaEvent = (practitionerId: string, input: OwnedAgendaInput, actor: AuditActor, canUseItransform: boolean) =>
  writeAgendaItem(actor, 'practice', 'create', practitionerId, { values: ownedValues(input, canUseItransform) });

export const updateOwnedAgendaEvent = (practitionerId: string, id: string, input: OwnedAgendaInput, actor: AuditActor, canUseItransform: boolean, revision?: string) =>
  writeAgendaItem(actor, 'practice', 'update', practitionerId, { id, revision, values: ownedValues(input, canUseItransform) });

export const deleteOwnedAgendaEvent = (practitionerId: string, id: string, actor: AuditActor, revision?: string) =>
  writeAgendaItem(actor, 'practice', 'delete', practitionerId, { id, revision });
