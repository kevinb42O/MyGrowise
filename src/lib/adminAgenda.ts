import { getSupabaseAdmin } from './supabase/server';
import { agendaEventValues, agendaRange, agendaRows, agendaUuid, calendarBookingStatuses, writeAgendaItem } from './agendaData';
import type { AuditActor } from './securityAudit';
import { createHash } from 'node:crypto';

export type AgendaEvent = {
  id: string;
  source: 'mygrowise' | 'itransform' | 'block';
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string;
  status: string;
  kind: 'appointment' | 'personal' | 'block';
  location: string;
  color: string;
  editable: boolean;
  practitionerId?: string | null;
  practitionerName?: string;
  revision?: string;
  externalSource?: 'mijndiad' | null;
  externalUrl?: string | null;
};

type CreatePracticeAgendaEvent = Pick<AgendaEvent, 'title' | 'startsAt' | 'endsAt' | 'location' | 'kind' | 'color'>
  & { practitionerId: string | null; calendarScope: 'mygrowise' };

export const listAgendaEvents = async (from: string, to: string, practitionerId?: string, viewerPractitionerId?: string): Promise<AgendaEvent[]> => {
  const client = getSupabaseAdmin();
  const bookingsQuery = client.from('bookings')
    .select('id,practitioner_id,client_name,appointment_name,offer:practitioner_appointment_types(appointment_types(treatment_groups(color))),starts_at,ends_at,status,location,channel,practitioners(name)')
    .in('status', calendarBookingStatuses).lt('starts_at', to).gt('ends_at', from).order('starts_at').order('id');
  const momentsQuery = client.from('practice_calendar_events')
    .select('id,title,starts_at,ends_at,status,event_kind,location,color,practitioner_id,updated_at,practitioners(name)')
    .eq('calendar_scope', 'mygrowise').eq('status', 'confirmed').lt('starts_at', to).gt('ends_at', from).order('starts_at').order('id');
  if (practitionerId) {
    bookingsQuery.eq('practitioner_id', practitionerId);
    momentsQuery.eq('practitioner_id', practitionerId);
  }
  // This identity comes from the authenticated session, never the filter URL.
  // An owner keeps their own private calendar details in either dashboard.
  const showOwnCalendar = viewerPractitionerId && (!practitionerId || practitionerId === viewerPractitionerId);
  const [bookings, moments, occupancy, ownPrivateEvents] = await Promise.all([
    agendaRows<any>(bookingsQuery),
    agendaRows<any>(momentsQuery),
    agendaRows<any>(client.rpc('agenda_private_occupancy', { p_from: from, p_to: to, p_practitioner: practitionerId || null }).order('starts_at').order('id')),
    showOwnCalendar ? agendaRows<any>(client.from('practice_calendar_events')
      .select('id,title,starts_at,ends_at,status,event_kind,location,color,practitioner_id,updated_at,external_source,external_url,practitioners(name)')
      .eq('practitioner_id', viewerPractitionerId).eq('calendar_scope', 'itransform').eq('status', 'confirmed')
      .lt('starts_at', to).gt('ends_at', from).order('starts_at').order('id')) : Promise.resolve([]),
  ]);
  // Match the RPC's anonymous event IDs exactly, preserving separate exceptions
  // even if an exception and imported appointment have identical times.
  const ownOccupancyIds = new Set(ownPrivateEvents.map(row => {
    const hex = createHash('md5').update(`event:${row.id}`).digest('hex');
    return hex.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
  }));
  return [
    ...bookings.map((row): AgendaEvent => ({
      id: row.id, source: 'mygrowise', title: row.client_name, subtitle: [row.appointment_name, row.practitioners?.name].filter(Boolean).join(' · '),
      startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, kind: 'appointment',
      location: row.channel === 'online' ? 'Online' : row.location || '', color: row.offer?.appointment_types?.treatment_groups?.color || '#1f7060',
      editable: false, practitionerId: row.practitioner_id, practitionerName: row.practitioners?.name,
    })),
    ...moments.map((row): AgendaEvent => ({
      id: row.id, source: 'mygrowise', title: row.title, subtitle: row.location || 'MyGrowise', startsAt: row.starts_at, endsAt: row.ends_at,
      status: row.status, kind: row.event_kind, location: row.location, color: row.color, editable: true, practitionerId: row.practitioner_id, practitionerName: row.practitioners?.name, revision: row.updated_at,
    })),
    ...ownPrivateEvents.map((row): AgendaEvent => ({
      id: row.id, source: 'itransform', title: row.title,
      subtitle: row.external_source === 'mijndiad' ? 'MijnDiAd' : row.location || '',
      startsAt: row.starts_at, endsAt: row.ends_at, status: row.status, kind: row.event_kind,
      location: row.location || '', color: row.color || '#d26479', editable: false,
      practitionerId: row.practitioner_id, practitionerName: row.practitioners?.name,
      externalSource: row.external_source, externalUrl: row.external_source === 'mijndiad' && /^https:\/\/praktijkitransform\.mijndiad\.nl\/appointments\/\d+$/.test(row.external_url || '') ? row.external_url : null,
    })),
    ...occupancy.filter(row => !ownOccupancyIds.has(row.id)).map((row): AgendaEvent => ({
      id: row.id, source: 'block', title: 'Niet beschikbaar', subtitle: row.practitioner_name,
      startsAt: row.starts_at, endsAt: row.ends_at, status: 'confirmed', kind: 'block', location: '', color: '#687985', editable: false,
      practitionerId: row.practitioner_id, practitionerName: row.practitioner_name,
    })),
  ].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
};

export const listAgendaPractitioners = () => agendaRows<{ id: string; name: string; active: boolean }>(
  getSupabaseAdmin().from('practitioners').select('id,name,active').order('name').order('id'),
);

const assignedValues = (input: CreatePracticeAgendaEvent) => {
  if (input.calendarScope !== 'mygrowise' || !input.practitionerId || !agendaUuid.test(input.practitionerId)) throw new Error('invalid_event');
  return agendaEventValues(input);
};

export const createPracticeAgendaEvent = (input: CreatePracticeAgendaEvent, actor: AuditActor) =>
  writeAgendaItem(actor, 'admin', 'create', input.practitionerId, { values: assignedValues(input) });

export const updatePracticeAgendaEvent = (id: string, input: CreatePracticeAgendaEvent, actor: AuditActor, revision?: string) =>
  writeAgendaItem(actor, 'admin', 'update', input.practitionerId, { id, revision, values: assignedValues(input) });

export const movePracticeAgendaEvent = (id: string, startsAt: string, endsAt: string, actor: AuditActor, revision?: string) => {
  if (!agendaRange(startsAt, endsAt, 367)) throw new Error('invalid_event');
  return writeAgendaItem(actor, 'admin', 'move', null, { id, revision, values: { starts_at: startsAt, ends_at: endsAt } });
};

export const deletePracticeAgendaEvent = (id: string, actor: AuditActor, revision?: string) =>
  writeAgendaItem(actor, 'admin', 'delete', null, { id, revision });
