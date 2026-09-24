import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type Row = Record<string, any>;
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'database_error'); };
const sanitizeText = (value: unknown, maximum: number) => String(value || '').replace(/\u0000/g, '').trim().replace(/\r\n/g, '\n').slice(0, maximum);

export type StaffContact = { id: string; name: string; email: string; roles: string[] };
export type InternalThread = { id: string; subject: string; lastMessageAt: string; unread: boolean; participants: string[]; lastMessagePreview: string };
export type InternalMessage = { id: string; senderId: string; senderName: string; body: string; createdAt: string };
export type InternalThreadDetail = { id: string; subject: string; participants: StaffContact[]; messages: InternalMessage[] };
export type InternalNotification = { id: string; threadId: string | null; supportConversationId: string | null; title: string; createdAt: string };

const profileNames = async (ids: string[]) => {
  const unique = [...new Set(ids.filter(uuid))];
  if (!unique.length) return new Map<string, string>();
  const { data, error } = await getSupabaseAdmin().from('profiles').select('id,full_name').in('id', unique);
  fail(error); return new Map(((data || []) as Row[]).map((item) => [String(item.id), String(item.full_name || 'MyGrowise-team')]));
};

export const listMessageContacts = async (excludeUserId: string): Promise<StaffContact[]> => {
  const client = getSupabaseAdmin();
  const [{ data: roleRows, error: roleError }, { data: authData, error: authError }] = await Promise.all([
    client.from('user_roles').select('user_id,role').neq('role', 'customer'), client.auth.admin.listUsers({ page: 1, perPage: 100 }),
  ]);
  fail(roleError); if (authError) throw new Error('contacts_unavailable');
  const roles = new Map<string, string[]>();
  ((roleRows || []) as Row[]).forEach((item) => roles.set(String(item.user_id), [...(roles.get(String(item.user_id)) || []), String(item.role)]));
  return authData.users.filter((user) => user.id !== excludeUserId && roles.has(user.id) && !(user.banned_until && new Date(user.banned_until).getTime() > Date.now())).map((user) => ({ id: user.id, name: String(user.user_metadata?.full_name || user.email || 'MyGrowise-team'), email: user.email || '', roles: roles.get(user.id) || [] })).sort((a, b) => a.name.localeCompare(b.name));
};

export const listInternalThreads = async (userId: string): Promise<InternalThread[]> => {
  const client = getSupabaseAdmin();
  const { data: participantRows, error: participantError } = await client.from('internal_thread_participants').select('thread_id,last_read_at').eq('user_id', userId);
  fail(participantError);
  const reads = new Map(((participantRows || []) as Row[]).map((item) => [String(item.thread_id), item.last_read_at ? String(item.last_read_at) : null]));
  const ids = [...reads.keys()]; if (!ids.length) return [];
  const [{ data: threads, error: threadError }, { data: participants, error: allParticipantsError }, { data: messages, error: messageError }] = await Promise.all([
    client.from('internal_threads').select('id,subject,last_message_at').in('id', ids).order('last_message_at', { ascending: false }),
    client.from('internal_thread_participants').select('thread_id,user_id').in('thread_id', ids),
    client.from('internal_messages').select('thread_id,body,created_at').in('thread_id', ids).order('created_at', { ascending: false }),
  ]);
  fail(threadError); fail(allParticipantsError); fail(messageError);
  const participantNames = await profileNames(((participants || []) as Row[]).map((item) => String(item.user_id)));
  const participantMap = new Map<string, string[]>();
  ((participants || []) as Row[]).forEach((item) => participantMap.set(String(item.thread_id), [...(participantMap.get(String(item.thread_id)) || []), participantNames.get(String(item.user_id)) || 'MyGrowise-team']));
  const newest = new Map<string, Row>();
  ((messages || []) as Row[]).forEach((item) => { if (!newest.has(String(item.thread_id))) newest.set(String(item.thread_id), item); });
  return ((threads || []) as Row[]).map((thread) => {
    const latest = newest.get(String(thread.id)); const lastRead = reads.get(String(thread.id));
    return { id: String(thread.id), subject: String(thread.subject), lastMessageAt: String(thread.last_message_at), unread: Boolean(latest && (!lastRead || new Date(latest.created_at).getTime() > new Date(lastRead).getTime())), participants: (participantMap.get(String(thread.id)) || []).filter((name) => name !== participantNames.get(userId)), lastMessagePreview: latest ? sanitizeText(latest.body, 120) : '' };
  });
};

const assertParticipant = async (threadId: string, userId: string) => {
  if (!uuid(threadId) || !uuid(userId)) throw new Error('not_found');
  const { data, error } = await getSupabaseAdmin().from('internal_thread_participants').select('thread_id').eq('thread_id', threadId).eq('user_id', userId).maybeSingle();
  fail(error); if (!data) throw new Error('forbidden');
};

export const getInternalThread = async (threadId: string, userId: string): Promise<InternalThreadDetail | null> => {
  try { await assertParticipant(threadId, userId); } catch (error) { if (error instanceof Error && ['not_found', 'forbidden'].includes(error.message)) return null; throw error; }
  const client = getSupabaseAdmin();
  const [{ data: thread, error: threadError }, { data: participantRows, error: participantError }, { data: messageRows, error: messageError }] = await Promise.all([
    client.from('internal_threads').select('id,subject').eq('id', threadId).maybeSingle(), client.from('internal_thread_participants').select('user_id').eq('thread_id', threadId), client.from('internal_messages').select('id,sender_user_id,body,created_at').eq('thread_id', threadId).order('created_at'),
  ]);
  fail(threadError); fail(participantError); fail(messageError); if (!thread) return null;
  const ids = [...((participantRows || []) as Row[]).map((item) => String(item.user_id)), ...((messageRows || []) as Row[]).map((item) => String(item.sender_user_id))];
  const names = await profileNames(ids); const contacts = await listMessageContacts('');
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  await Promise.all([
    client.from('internal_thread_participants').update({ last_read_at: new Date().toISOString() }).eq('thread_id', threadId).eq('user_id', userId),
    client.from('internal_notifications').update({ read_at: new Date().toISOString() }).eq('thread_id', threadId).eq('recipient_user_id', userId).is('read_at', null),
  ]);
  return { id: String(thread.id), subject: String(thread.subject), participants: ((participantRows || []) as Row[]).map((item) => ({ id: String(item.user_id), name: names.get(String(item.user_id)) || 'MyGrowise-team', email: contactById.get(String(item.user_id))?.email || '', roles: contactById.get(String(item.user_id))?.roles || [] })), messages: ((messageRows || []) as Row[]).map((item) => ({ id: String(item.id), senderId: String(item.sender_user_id), senderName: names.get(String(item.sender_user_id)) || 'MyGrowise-team', body: String(item.body), createdAt: String(item.created_at) })) };
};

export const createInternalThread = async (input: { subject: unknown; body: unknown; recipientIds: string[]; senderId: string }, actor: AuditActor) => {
  const subject = sanitizeText(input.subject, 180); const body = sanitizeText(input.body, 4000);
  const recipientIds = [...new Set(input.recipientIds.filter(uuid).filter((id) => id !== input.senderId))];
  if (subject.length < 2 || body.length < 1 || !uuid(input.senderId) || !recipientIds.length) throw new Error('invalid_input');
  const allowed = new Set((await listMessageContacts(input.senderId)).map((contact) => contact.id));
  if (recipientIds.some((id) => !allowed.has(id))) throw new Error('invalid_recipient');
  const client = getSupabaseAdmin();
  const { data: thread, error: threadError } = await client.from('internal_threads').insert({ subject, created_by: input.senderId }).select('id,subject').single();
  fail(threadError); if (!thread) throw new Error('database_error');
  const { error: participantError } = await client.from('internal_thread_participants').insert([input.senderId, ...recipientIds].map((userId) => ({ thread_id: thread.id, user_id: userId, last_read_at: userId === input.senderId ? new Date().toISOString() : null })));
  fail(participantError);
  const { data: message, error: messageError } = await client.from('internal_messages').insert({ thread_id: thread.id, sender_user_id: input.senderId, body }).select('id').single();
  fail(messageError);
  await writeSecurityAudit({ actor, action: 'internal_thread.created', objectType: 'internal_thread', objectId: String(thread.id), metadata: { recipient_count: recipientIds.length, message_id: message?.id || null } });
  return String(thread.id);
};

export const sendInternalMessage = async (input: { threadId: string; senderId: string; body: unknown }, actor: AuditActor) => {
  const body = sanitizeText(input.body, 4000); if (!body || !uuid(input.senderId)) throw new Error('invalid_input');
  await assertParticipant(input.threadId, input.senderId);
  const client = getSupabaseAdmin();
  const { data, error } = await client.from('internal_messages').insert({ thread_id: input.threadId, sender_user_id: input.senderId, body }).select('id').single();
  fail(error); if (!data) throw new Error('database_error');
  const { error: readStateError } = await client.from('internal_thread_participants').update({ last_read_at: new Date().toISOString() }).eq('thread_id', input.threadId).eq('user_id', input.senderId);
  fail(readStateError);
  await writeSecurityAudit({ actor, action: 'internal_message.sent', objectType: 'internal_thread', objectId: input.threadId, metadata: { message_id: data.id } });
};

export const listUnreadNotifications = async (userId: string): Promise<InternalNotification[]> => {
  const { data, error } = await getSupabaseAdmin().from('internal_notifications').select('id,thread_id,support_conversation_id,title,created_at').eq('recipient_user_id', userId).is('read_at', null).order('created_at', { ascending: false }).limit(20);
  fail(error); return ((data || []) as Row[]).map((item) => ({ id: String(item.id), threadId: item.thread_id ? String(item.thread_id) : null, supportConversationId: item.support_conversation_id ? String(item.support_conversation_id) : null, title: String(item.title), createdAt: String(item.created_at) }));
};

export const markNotificationsRead = async (userId: string, ids?: string[]) => {
  const query = getSupabaseAdmin().from('internal_notifications').update({ read_at: new Date().toISOString() }).eq('recipient_user_id', userId).is('read_at', null);
  const { error } = ids?.length ? await query.in('id', ids.filter(uuid)) : await query;
  fail(error);
};
