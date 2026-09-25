import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type RecordRow = Record<string, any>;

export type AgendaSource = 'mygrowise' | 'itransform';
export type AgendaEvent = {
  id: string;
  source: AgendaSource;
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
};

export type CreatePracticeAgendaEvent = Pick<AgendaEvent, 'title' | 'startsAt' | 'endsAt' | 'location'> & {
  kind: AgendaEvent['kind'];
  color: string;
  practitionerId: string | null;
  calendarScope: AgendaSource;
};
export type UpdatePracticeAgendaEvent = CreatePracticeAgendaEvent;

const fail = (error: { message?: string } | null) => {
  if (error) throw new Error(error.message || 'Supabase query failed.');
};

const validDate = (value: string) => Number.isFinite(new Date(value).getTime());

export const listAgendaEvents = async (from: string, to: string): Promise<AgendaEvent[]> => {
  const client = getSupabaseAdmin();
  const [bookingsResult, practiceResult] = await Promise.all([
    client
      .from('bookings')
      .select('id,practitioner_id,client_name,client_email,starts_at,ends_at,status,practitioners(name)')
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', to)
      .gt('ends_at', from)
      .order('starts_at'),
    client
      .from('practice_calendar_events')
      .select('id,title,starts_at,ends_at,status,event_kind,location,color,practitioner_id,calendar_scope')
      .eq('status', 'confirmed')
      .lt('starts_at', to)
      .gt('ends_at', from)
      .order('starts_at'),
  ]);
  fail(bookingsResult.error);
  fail(practiceResult.error);

  const bookings = ((bookingsResult.data || []) as RecordRow[]).map((row) => ({
    id: String(row.id), source: 'mygrowise' as const,
    title: String(row.client_name),
    subtitle: `${String(row.practitioners?.name || 'Begeleiding')} · ${String(row.client_email)}`,
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status),
    kind: 'appointment' as const, location: '', color: row.status === 'pending' ? '#b7791f' : '#1f7060', editable: false,
    practitionerId: String(row.practitioner_id),
  }));
  const practice = ((practiceResult.data || []) as RecordRow[]).map((row) => ({
    id: String(row.id), source: (row.calendar_scope === 'mygrowise' ? 'mygrowise' : 'itransform') as AgendaSource,
    title: String(row.title), subtitle: String(row.location || (row.calendar_scope === 'mygrowise' ? 'MyGrowise' : 'Praktijk Itransform')),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status),
    kind: row.event_kind as AgendaEvent['kind'], location: String(row.location || ''), color: String(row.color || '#d26479'), editable: true,
    practitionerId: row.practitioner_id ? String(row.practitioner_id) : null,
  }));
  return [...bookings, ...practice].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
};

export const listAgendaPractitioners = async () => {
  const { data, error } = await getSupabaseAdmin().from('practitioners').select('id,name,slug').eq('active', true).order('name');
  fail(error);
  return (data || []).map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug) }));
};

const validateCalendarAssignment = async (calendarScope: AgendaSource, practitionerId: string | null) => {
  if (!['mygrowise', 'itransform'].includes(calendarScope)
    || (calendarScope === 'mygrowise' && !practitionerId)) throw new Error('invalid_event');
  if (calendarScope === 'itransform' && practitionerId) {
    const { data, error } = await getSupabaseAdmin().from('practitioners').select('slug').eq('id', practitionerId).maybeSingle();
    fail(error);
    if (data?.slug !== 'virginie') throw new Error('invalid_event');
  }
};

export const createPracticeAgendaEvent = async (input: CreatePracticeAgendaEvent, actor: AuditActor) => {
  const title = input.title.trim();
  const location = input.location.trim(); const color = input.color.trim();
  if (title.length < 2 || title.length > 100 || location.length > 120 || !/^#[0-9a-f]{6}$/i.test(color) || !['appointment', 'personal', 'block'].includes(input.kind) || !validDate(input.startsAt) || !validDate(input.endsAt) || new Date(input.endsAt) <= new Date(input.startsAt) || (input.practitionerId && !/^[0-9a-f-]{36}$/i.test(input.practitionerId))) {
    throw new Error('invalid_event');
  }
  await validateCalendarAssignment(input.calendarScope, input.practitionerId);
  const { data, error } = await getSupabaseAdmin()
    .from('practice_calendar_events')
    .insert({ title, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind, location, color, practitioner_id: input.practitionerId, calendar_scope: input.calendarScope, created_by: actor.userId || null })
    .select('id,title,starts_at,ends_at,status,event_kind,location,color')
    .single();
  fail(error);
  if (!data) throw new Error('Agenda event could not be created.');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.created', objectType: 'practice_calendar_event', objectId: String(data.id), after: { title, event_kind: input.kind, starts_at: input.startsAt, ends_at: input.endsAt, practitioner_id: input.practitionerId } });
  return data;
};

export const deletePracticeAgendaEvent = async (id: string, actor: AuditActor) => {
  const { data, error } = await getSupabaseAdmin().from('practice_calendar_events').delete().eq('id', id).select('id,title,starts_at,ends_at,event_kind').maybeSingle();
  fail(error);
  if (!data) throw new Error('not_found');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.deleted', objectType: 'practice_calendar_event', objectId: String(data.id), before: data });
};

export const updatePracticeAgendaEvent = async (id: string, input: UpdatePracticeAgendaEvent, actor: AuditActor) => {
  const title = input.title.trim();
  const location = input.location.trim(); const color = input.color.trim();
  if (!title || title.length > 100 || location.length > 120 || !/^#[0-9a-f]{6}$/i.test(color) || !['appointment', 'personal', 'block'].includes(input.kind) || !validDate(input.startsAt) || !validDate(input.endsAt) || new Date(input.endsAt) <= new Date(input.startsAt) || (input.practitionerId && !/^[0-9a-f-]{36}$/i.test(input.practitionerId))) throw new Error('invalid_event');
  await validateCalendarAssignment(input.calendarScope, input.practitionerId);
  const client = getSupabaseAdmin();
  const { data: before, error: beforeError } = await client.from('practice_calendar_events').select('id,title,starts_at,ends_at,event_kind,location,color,practitioner_id').eq('id', id).maybeSingle();
  fail(beforeError);
  if (!before) throw new Error('not_found');
  const { data, error } = await client.from('practice_calendar_events')
    .update({ title, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind, location, color, practitioner_id: input.practitionerId, calendar_scope: input.calendarScope })
    .eq('id', id)
    .select('id,title,starts_at,ends_at,status,event_kind,location,color')
    .maybeSingle();
  fail(error);
  if (!data) throw new Error('not_found');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.updated', objectType: 'practice_calendar_event', objectId: id, before, after: data });
  return data;
};
