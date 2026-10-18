import { getSupabaseAdmin } from './supabase/server';
import { getBookableSlots } from './practiceStore';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type Row = Record<string, any>;
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
};

export const listPracticeAgenda = async (practitionerId: string, from: string, to: string, canUseItransform: boolean): Promise<PracticeAgendaItem[]> => {
  const client = getSupabaseAdmin();
  const [bookings, exceptions, ownedEvents, itransformEvents, slots] = await Promise.all([
    client.from('bookings')
      .select('id,patient_id,client_name,client_email,appointment_name,offer:practitioner_appointment_types(appointment_types(treatment_groups(color))),starts_at,ends_at,status')
      .eq('practitioner_id', practitionerId)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', to).gt('ends_at', from).order('starts_at'),
    client.from('availability_exceptions')
      .select('id,starts_at,ends_at,private_reason')
      .eq('practitioner_id', practitionerId).eq('kind', 'unavailable')
      .lt('starts_at', to).gt('ends_at', from).order('starts_at'),
    client.from('practice_calendar_events')
      .select('id,title,starts_at,ends_at,event_kind,location,color,calendar_scope,external_source,external_url')
      .eq('practitioner_id', practitionerId).eq('calendar_scope', 'mygrowise').eq('status', 'confirmed')
      .lt('starts_at', to).gt('ends_at', from).order('starts_at'),
    canUseItransform ? client.from('practice_calendar_events')
      .select('id,title,starts_at,ends_at,event_kind,location,color,calendar_scope,external_source,external_url')
      .eq('practitioner_id', practitionerId).eq('calendar_scope', 'itransform').eq('status', 'confirmed')
      .lt('starts_at', to).gt('ends_at', from).order('starts_at') : Promise.resolve({ data: [], error: null }),
    // A source outage must not hide existing appointments or suggest free time.
    getBookableSlots(practitionerId, 62).catch(() => []),
  ]);
  if (bookings.error || exceptions.error || ownedEvents.error || itransformEvents.error) throw bookings.error || exceptions.error || ownedEvents.error || itransformEvents.error;

  const appointments: PracticeAgendaItem[] = ((bookings.data || []) as Row[]).map((row) => ({
    id: String(row.id), source: 'mygrowise', title: String(row.client_name),
    subtitle: `${String(row.appointment_name)} · ${String(row.client_email)}`, startsAt: String(row.starts_at), endsAt: String(row.ends_at),
    status: String(row.status), kind: 'appointment', location: '',
    color: row.offer?.appointment_types?.treatment_groups?.color || '#1f7060', editable: false,
    patientId: row.patient_id ? String(row.patient_id) : null,
  }));
  const blocks: PracticeAgendaItem[] = ((exceptions.data || []) as Row[]).map((row) => ({
    id: String(row.id), source: 'block', title: 'Niet beschikbaar',
    subtitle: row.private_reason ? String(row.private_reason) : 'Privéblokkade',
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: 'confirmed',
    kind: 'block', location: '', color: '#6b7280', editable: false,
  }));
  const customEvents: PracticeAgendaItem[] = ([...(ownedEvents.data || []), ...(itransformEvents.data || [])] as Row[]).map((row) => ({
    id: String(row.id), source: row.calendar_scope === 'itransform' ? 'itransform' : 'mygrowise', title: String(row.title),
    subtitle: row.external_source === 'mijndiad' ? ['MijnDiAd', row.location].filter(Boolean).join(' · ') : String(row.location || (row.calendar_scope === 'itransform' ? 'Praktijk Itransform' : 'MyGrowise')),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: 'confirmed',
    kind: String(row.event_kind) as PracticeAgendaItem['kind'],
    location: String(row.location || ''), color: String(row.color || '#d26479'), editable: !row.external_source,
    externalSource: row.external_source === 'mijndiad' ? 'mijndiad' : null,
    externalUrl: row.external_source === 'mijndiad' && /^https:\/\/praktijkitransform\.mijndiad\.nl\/appointments\/\d+$/.test(row.external_url || '') ? row.external_url : null,
  }));
  const available: PracticeAgendaItem[] = [];
  for (const slot of slots.filter((item) => Date.parse(item.startsAt) < Date.parse(to) && Date.parse(item.endsAt) > Date.parse(from))
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))) {
    const previous = available.at(-1);
    if (previous && Date.parse(slot.startsAt) <= Date.parse(previous.endsAt)) {
      if (Date.parse(slot.endsAt) > Date.parse(previous.endsAt)) previous.endsAt = slot.endsAt;
      continue;
    }
    available.push({
      id: `${slot.startsAt}/${slot.endsAt}`, source: 'availability', title: '', subtitle: '',
      startsAt: slot.startsAt, endsAt: slot.endsAt, status: 'available', kind: 'availability',
      location: '', color: '#e7f4eb', editable: false,
    });
  }
  return [...available, ...blocks, ...customEvents, ...appointments];
};

export type OwnedAgendaInput = {
  title: string; startsAt: string; endsAt: string;
  kind: 'appointment' | 'personal' | 'block'; location: string; color: string; calendarScope: CalendarScope;
};

const validateOwnedEvent = (input: OwnedAgendaInput, canUseItransform: boolean) => {
  const title = input.title.trim(); const location = input.location.trim(); const color = input.color.trim();
  const start = Date.parse(input.startsAt); const end = Date.parse(input.endsAt);
  if (input.calendarScope === 'itransform' && !canUseItransform) throw new Error('not_allowed');
  if (title.length < 2 || title.length > 100 || location.length > 120 || !/^#[0-9a-f]{6}$/i.test(color)
    || !['appointment', 'personal', 'block'].includes(input.kind)
    || !['mygrowise', 'itransform'].includes(input.calendarScope)
    || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 366 * 86400000) {
    throw new Error('invalid_event');
  }
  return { title, location, color, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind, calendar_scope: input.calendarScope };
};

export const createOwnedAgendaEvent = async (practitionerId: string, input: OwnedAgendaInput, actor: AuditActor, canUseItransform: boolean) => {
  const values = validateOwnedEvent(input, canUseItransform);
  const { data, error } = await getSupabaseAdmin().from('practice_calendar_events')
    .insert({ ...values, practitioner_id: practitionerId, created_by: actor.userId })
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind,calendar_scope').single();
  if (error) throw error;
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.created', objectType: 'practice_calendar_event', objectId: String(data.id), after: data });
  return String(data.id);
};

export const updateOwnedAgendaEvent = async (practitionerId: string, id: string, input: OwnedAgendaInput, actor: AuditActor, canUseItransform: boolean) => {
  const values = validateOwnedEvent(input, canUseItransform);
  const client = getSupabaseAdmin();
  const { data: before, error: readError } = await client.from('practice_calendar_events')
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind,location,color,calendar_scope,external_source')
    .eq('id', id).maybeSingle();
  if (readError) throw readError;
  if (!before || before.external_source || before.practitioner_id !== practitionerId || !(before.calendar_scope === 'itransform' && canUseItransform || before.calendar_scope === 'mygrowise')) throw new Error('not_found');
  const { data, error } = await client.from('practice_calendar_events')
    .update({ ...values, practitioner_id: input.calendarScope === 'mygrowise' ? practitionerId : before.practitioner_id || practitionerId })
    .eq('id', id)
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind,location,color,calendar_scope').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('not_found');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.updated', objectType: 'practice_calendar_event', objectId: id, before, after: data });
};

export const deleteOwnedAgendaEvent = async (practitionerId: string, id: string, actor: AuditActor, canUseItransform: boolean) => {
  const client = getSupabaseAdmin();
  const { data: before, error: readError } = await client.from('practice_calendar_events')
    .select('id,practitioner_id,title,starts_at,ends_at,event_kind,calendar_scope,external_source').eq('id', id).maybeSingle();
  if (readError) throw readError;
  if (!before || before.external_source || before.practitioner_id !== practitionerId || !(before.calendar_scope === 'itransform' && canUseItransform || before.calendar_scope === 'mygrowise')) throw new Error('not_found');
  const { data, error } = await client.from('practice_calendar_events').delete()
    .eq('id', id).select('id,practitioner_id,title,starts_at,ends_at,event_kind,calendar_scope').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('not_found');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.deleted', objectType: 'practice_calendar_event', objectId: id, before: data });
};
