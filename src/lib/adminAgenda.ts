import { getSupabaseAdmin } from './supabase/server';
import { agendaEventValues, agendaRange, agendaRows, agendaUuid, calendarBookingStatuses, writeAgendaItem } from './agendaData';
import type { AuditActor } from './securityAudit';

export type AgendaEvent = {
  id: string;
  source: 'mygrowise' | 'block';
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
};

type CreatePracticeAgendaEvent = Pick<AgendaEvent, 'title' | 'startsAt' | 'endsAt' | 'location' | 'kind' | 'color'>
  & { practitionerId: string | null; calendarScope: 'mygrowise' };

export const listAgendaEvents = async (from: string, to: string, practitionerId?: string): Promise<AgendaEvent[]> => {
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
  const [bookings, moments, occupancy] = await Promise.all([
    agendaRows<any>(bookingsQuery),
    agendaRows<any>(momentsQuery),
    agendaRows<any>(client.rpc('agenda_private_occupancy', { p_from: from, p_to: to, p_practitioner: practitionerId || null }).order('starts_at').order('id')),
  ]);
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
    ...occupancy.map((row): AgendaEvent => ({
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
