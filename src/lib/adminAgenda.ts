import { getSupabaseAdmin } from './supabase/server';

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
  editable: boolean;
};

export type CreatePracticeAgendaEvent = Pick<AgendaEvent, 'title' | 'startsAt' | 'endsAt' | 'location'> & {
  kind: AgendaEvent['kind'];
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
      .select('id,title,starts_at,ends_at,status,event_kind,location')
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
    kind: 'appointment' as const, location: '', editable: false,
  }));
  const practice = ((practiceResult.data || []) as RecordRow[]).map((row) => ({
    id: String(row.id), source: 'itransform' as const,
    title: String(row.title), subtitle: String(row.location || 'Praktijk Itransform'),
    startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status),
    kind: row.event_kind as AgendaEvent['kind'], location: String(row.location || ''), editable: true,
  }));
  return [...bookings, ...practice].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
};

export const createPracticeAgendaEvent = async (input: CreatePracticeAgendaEvent, actorEmail: string) => {
  const title = input.title.trim();
  const location = input.location.trim();
  if (title.length < 2 || title.length > 100 || location.length > 120 || !['appointment', 'personal', 'block'].includes(input.kind) || !validDate(input.startsAt) || !validDate(input.endsAt) || new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new Error('invalid_event');
  }
  const { data, error } = await getSupabaseAdmin()
    .from('practice_calendar_events')
    .insert({ title, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind, location })
    .select('id,title,starts_at,ends_at,status,event_kind,location')
    .single();
  fail(error);
  await getSupabaseAdmin().from('security_audit_log').insert({
    action: 'practice_calendar_event.created', object_type: 'practice_calendar_event', object_id: String(data.id),
    metadata: { actor: actorEmail, event_kind: input.kind, starts_at: input.startsAt },
  });
  return data;
};

export const deletePracticeAgendaEvent = async (id: string, actorEmail: string) => {
  const { data, error } = await getSupabaseAdmin().from('practice_calendar_events').delete().eq('id', id).select('id,title').maybeSingle();
  fail(error);
  if (!data) throw new Error('not_found');
  await getSupabaseAdmin().from('security_audit_log').insert({
    action: 'practice_calendar_event.deleted', object_type: 'practice_calendar_event', object_id: String(data.id), metadata: { actor: actorEmail },
  });
};

export const updatePracticeAgendaEvent = async (id: string, input: UpdatePracticeAgendaEvent, actorEmail: string) => {
  const title = input.title.trim();
  const location = input.location.trim();
  if (!title || title.length > 100 || location.length > 120 || !['appointment', 'personal', 'block'].includes(input.kind) || !validDate(input.startsAt) || !validDate(input.endsAt) || new Date(input.endsAt) <= new Date(input.startsAt)) throw new Error('invalid_event');
  const { data, error } = await getSupabaseAdmin().from('practice_calendar_events')
    .update({ title, starts_at: input.startsAt, ends_at: input.endsAt, event_kind: input.kind, location })
    .eq('id', id)
    .select('id,title,starts_at,ends_at,status,event_kind,location')
    .maybeSingle();
  fail(error);
  if (!data) throw new Error('not_found');
  await getSupabaseAdmin().from('security_audit_log').insert({
    action: 'practice_calendar_event.updated', object_type: 'practice_calendar_event', object_id: id,
    metadata: { actor: actorEmail, event_kind: input.kind, starts_at: input.startsAt },
  });
  return data;
};
