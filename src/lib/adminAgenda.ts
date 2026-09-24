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
};

export type CreatePracticeAgendaEvent = Pick<AgendaEvent, 'title' | 'startsAt' | 'endsAt' | 'location'> & {
  kind: AgendaEvent['kind'];
  color: string;
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
      .select('id,client_name,client_email,starts_at,ends_at,status,practitioners(name)')
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', to)
      .gt('ends_at', from)
      .order('starts_at'),
    client
      .from('practice_calendar_events')
      .select('id,title,starts_at,ends_at,status,event_kind,location,color')
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
    kind: 'appointment' as const, location: '', color: '#1f7060', editable: false,
  }));
  const practice = ((practiceResult.data || []) as RecordRow[]).map((row) => ({
    id: String(row.id), source: 'itransform' as const,
    title: String(row.title), subtitle: String(row.location || 'Praktijk Itransform'),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status),
    kind: row.event_kind as AgendaEvent['kind'], location: String(row.location || ''), color: String(row.color || '#d26479'), editable: true,
  }));
  return [...bookings, ...practice].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
};

export const createPracticeAgendaEvent = async (input: CreatePracticeAgendaEvent, actor: AuditActor) => {
  const title = input.title.trim();
  const location = input.location.trim(); const color = input.color.trim();
  if (title.length < 2 || title.length > 100 || location.length > 120 || !/^#[0-9a-f]{6}$/i.test(color) || !['appointment', 'personal', 'block'].includes(input.kind) || !validDate(input.startsAt) || !validDate(input.endsAt) || new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new Error('invalid_event');
  }
  const { data, error } = await getSupabaseAdmin()
    .from('practice_calendar_events')
    .insert({ title, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind, location, color })
    .select('id,title,starts_at,ends_at,status,event_kind,location,color')
    .single();
  fail(error);
  if (!data) throw new Error('Agenda event could not be created.');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.created', objectType: 'practice_calendar_event', objectId: String(data.id), after: { title, event_kind: input.kind, starts_at: input.startsAt, ends_at: input.endsAt } });
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
  if (!title || title.length > 100 || location.length > 120 || !/^#[0-9a-f]{6}$/i.test(color) || !['appointment', 'personal', 'block'].includes(input.kind) || !validDate(input.startsAt) || !validDate(input.endsAt) || new Date(input.endsAt) <= new Date(input.startsAt)) throw new Error('invalid_event');
  const client = getSupabaseAdmin();
  const { data: before, error: beforeError } = await client.from('practice_calendar_events').select('id,title,starts_at,ends_at,event_kind,location,color').eq('id', id).maybeSingle();
  fail(beforeError);
  if (!before) throw new Error('not_found');
  const { data, error } = await client.from('practice_calendar_events')
    .update({ title, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind, location, color })
    .eq('id', id)
    .select('id,title,starts_at,ends_at,status,event_kind,location,color')
    .maybeSingle();
  fail(error);
  if (!data) throw new Error('not_found');
  await writeSecurityAudit({ actor, action: 'practice_calendar_event.updated', objectType: 'practice_calendar_event', objectId: id, before, after: data });
  return data;
};
