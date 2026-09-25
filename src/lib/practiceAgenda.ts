import { getSupabaseAdmin } from './supabase/server';
import { getBookableSlots } from './practiceStore';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type Row = Record<string, any>;

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
};

export const listPracticeAgenda = async (practitionerId: string, from: string, to: string): Promise<PracticeAgendaItem[]> => {
  const client = getSupabaseAdmin();
  const [bookings, exceptions, assignedEvents, slots] = await Promise.all([
    client.from('bookings')
      .select('id,patient_id,client_name,client_email,starts_at,ends_at,status')
      .eq('practitioner_id', practitionerId)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', to).gt('ends_at', from).order('starts_at'),
    client.from('availability_exceptions')
      .select('id,starts_at,ends_at,private_reason')
      .eq('practitioner_id', practitionerId).eq('kind', 'unavailable')
      .lt('starts_at', to).gt('ends_at', from).order('starts_at'),
    client.from('practice_calendar_events')
      .select('id,title,starts_at,ends_at,event_kind,location,color')
      .eq('practitioner_id', practitionerId).eq('status', 'confirmed')
      .lt('starts_at', to).gt('ends_at', from).order('starts_at'),
    getBookableSlots(practitionerId, 62),
  ]);
  if (bookings.error || exceptions.error || assignedEvents.error) throw bookings.error || exceptions.error || assignedEvents.error;

  const appointments: PracticeAgendaItem[] = ((bookings.data || []) as Row[]).map((row) => ({
    id: String(row.id), source: 'mygrowise', title: String(row.client_name),
    subtitle: String(row.client_email), startsAt: String(row.starts_at), endsAt: String(row.ends_at),
    status: String(row.status), kind: 'appointment', location: '',
    color: row.status === 'pending' ? '#b7791f' : '#1f7060', editable: false,
    patientId: row.patient_id ? String(row.patient_id) : null,
  }));
  const blocks: PracticeAgendaItem[] = ((exceptions.data || []) as Row[]).map((row) => ({
    id: String(row.id), source: 'block', title: 'Niet beschikbaar',
    subtitle: row.private_reason ? String(row.private_reason) : 'Privéblokkade',
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: 'confirmed',
    kind: 'block', location: '', color: '#6b7280', editable: false,
  }));
  const external: PracticeAgendaItem[] = ((assignedEvents.data || []) as Row[]).map((row) => ({
    id: String(row.id), source: 'itransform', title: String(row.title),
    subtitle: String(row.location || 'Praktijk Itransform'),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: 'confirmed',
    kind: String(row.event_kind) as PracticeAgendaItem['kind'],
    location: String(row.location || ''), color: String(row.color || '#d26479'), editable: true,
  }));
  const available: PracticeAgendaItem[] = slots
    .filter((slot) => slot.startsAt < to && slot.endsAt > from)
    .map((slot) => ({
      id: `${slot.startsAt}/${slot.endsAt}`, source: 'availability', title: 'Boekbaar', subtitle: '',
      startsAt: slot.startsAt, endsAt: slot.endsAt, status: 'available', kind: 'availability',
      location: '', color: '#e7f4eb', editable: false,
    }));
  return [...available, ...blocks, ...external, ...appointments];
};

export type OwnedAgendaInput = {
  title: string; startsAt: string; endsAt: string;
  kind: 'appointment' | 'personal' | 'block'; location: string; color: string;
};

const validateOwnedEvent = (input: OwnedAgendaInput) => {
  const title = input.title.trim(); const location = input.location.trim(); const color = input.color.trim();
  const start = Date.parse(input.startsAt); const end = Date.parse(input.endsAt);
  if (title.length < 2 || title.length > 100 || location.length > 120 || !/^#[0-9a-f]{6}$/i.test(color)
    || !['appointment', 'personal', 'block'].includes(input.kind)
    || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 366 * 86400000) {
    throw new Error('invalid_event');
  }
  return { title, location, color, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind };
};

export const createOwnedAgendaEvent = async (practitionerId: string, input: OwnedAgendaInput, actor: AuditActor) => {
  const values = validateOwnedEvent(input);
  const { data, error } = await getSupabaseAdmin().from('practice_calendar_events')
    .insert({ ...values, practitioner_id: practitionerId, created_by: actor.userId })
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind').single();
  if (error) throw error;
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.created', objectType: 'practice_calendar_event', objectId: String(data.id), after: data });
  return String(data.id);
};

export const updateOwnedAgendaEvent = async (practitionerId: string, id: string, input: OwnedAgendaInput, actor: AuditActor) => {
  const values = validateOwnedEvent(input);
  const client = getSupabaseAdmin();
  const { data: before, error: readError } = await client.from('practice_calendar_events')
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind,location,color')
    .eq('id', id).eq('practitioner_id', practitionerId).maybeSingle();
  if (readError) throw readError;
  if (!before) throw new Error('not_found');
  const { data, error } = await client.from('practice_calendar_events').update(values)
    .eq('id', id).eq('practitioner_id', practitionerId)
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind,location,color').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('not_found');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.updated', objectType: 'practice_calendar_event', objectId: id, before, after: data });
};

export const deleteOwnedAgendaEvent = async (practitionerId: string, id: string, actor: AuditActor) => {
  const { data, error } = await getSupabaseAdmin().from('practice_calendar_events').delete()
    .eq('id', id).eq('practitioner_id', practitionerId)
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('not_found');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.deleted', objectType: 'practice_calendar_event', objectId: id, before: data });
};
