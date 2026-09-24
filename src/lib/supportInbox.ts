import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type Row = Record<string, any>;
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'database_error'); };
const text = (value: unknown, max: number) => String(value || '').replace(/\u0000/g, '').trim().replace(/\r\n/g, '\n').slice(0, max);
const statuses = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const;
const priorities = ['low', 'normal', 'high', 'urgent'] as const;
const categories = ['general', 'order', 'access', 'booking', 'privacy', 'other'] as const;
export type SupportStatus = typeof statuses[number]; export type SupportPriority = typeof priorities[number]; export type SupportCategory = typeof categories[number];
export type SupportMessage = { id: string; senderId: string; senderName: string; body: string; internal: boolean; createdAt: string };
export type SupportConversation = { id: string; customerId: string; customerName: string; customerEmail: string; subject: string; category: SupportCategory; status: SupportStatus; priority: SupportPriority; assignedTo: string | null; assignedName: string | null; lastMessageAt: string; preview: string; unread: boolean; messages?: SupportMessage[] };

const people = async (ids: string[]) => {
  const unique = [...new Set(ids.filter(uuid))]; if (!unique.length) return new Map<string, { name: string; email: string }>();
  const client = getSupabaseAdmin(); const [{ data: profiles, error: profileError }, { data: users, error: userError }] = await Promise.all([
    client.from('profiles').select('id,full_name').in('id', unique), client.auth.admin.listUsers({ page: 1, perPage: 100 }),
  ]);
  fail(profileError); if (userError) throw new Error('contacts_unavailable');
  const profileMap = new Map(((profiles || []) as Row[]).map((item) => [String(item.id), String(item.full_name || '')]));
  return new Map(users.users.filter((item) => unique.includes(item.id)).map((item) => [item.id, { name: profileMap.get(item.id) || String(item.user_metadata?.full_name || item.email || 'MyGrowise-klant'), email: item.email || '' }]));
};

const mapConversation = async (row: Row, currentUserId: string, staff: boolean, messageRows: Row[] = []): Promise<SupportConversation> => {
  const ids = [String(row.customer_user_id), row.assigned_to ? String(row.assigned_to) : '', ...messageRows.map((message) => String(message.sender_user_id))];
  const names = await people(ids); const latest = messageRows[0]; const lastRead = staff ? row.staff_last_read_at : row.customer_last_read_at;
  return { id: String(row.id), customerId: String(row.customer_user_id), customerName: names.get(String(row.customer_user_id))?.name || 'Klant', customerEmail: names.get(String(row.customer_user_id))?.email || '', subject: String(row.subject), category: row.category as SupportCategory, status: row.status as SupportStatus, priority: row.priority as SupportPriority, assignedTo: row.assigned_to ? String(row.assigned_to) : null, assignedName: row.assigned_to ? names.get(String(row.assigned_to))?.name || null : null, lastMessageAt: String(row.last_message_at), preview: latest ? text(latest.body, 140) : '', unread: Boolean(latest && !latest.is_internal_note && (!lastRead || new Date(latest.created_at).getTime() > new Date(lastRead).getTime())), messages: messageRows.length ? messageRows.slice().reverse().filter((message) => staff || !message.is_internal_note).map((message) => ({ id: String(message.id), senderId: String(message.sender_user_id), senderName: names.get(String(message.sender_user_id))?.name || 'MyGrowise', body: String(message.body), internal: Boolean(message.is_internal_note), createdAt: String(message.created_at) })) : undefined };
};

export const listSupportConversations = async (actorId: string, staff: boolean): Promise<SupportConversation[]> => {
  const client = getSupabaseAdmin(); const query = client.from('support_conversations').select('id,customer_user_id,subject,category,status,priority,assigned_to,last_message_at,customer_last_read_at,staff_last_read_at').order('last_message_at', { ascending: false }).limit(100);
  const { data, error } = staff ? await query : await query.eq('customer_user_id', actorId); fail(error); const rows = (data || []) as Row[]; if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id)); const { data: messages, error: messageError } = await client.from('support_messages').select('conversation_id,sender_user_id,body,is_internal_note,created_at').in('conversation_id', ids).order('created_at', { ascending: false }); fail(messageError);
  const byConversation = new Map<string, Row[]>(); ((messages || []) as Row[]).forEach((message) => byConversation.set(String(message.conversation_id), [...(byConversation.get(String(message.conversation_id)) || []), message]));
  return Promise.all(rows.map((row) => mapConversation(row, actorId, staff, byConversation.get(String(row.id)) || [])));
};

export const getSupportConversation = async (id: string, actorId: string, staff: boolean): Promise<SupportConversation | null> => {
  if (!uuid(id)) return null; const client = getSupabaseAdmin(); let query = client.from('support_conversations').select('id,customer_user_id,subject,category,status,priority,assigned_to,last_message_at,customer_last_read_at,staff_last_read_at').eq('id', id); if (!staff) query = query.eq('customer_user_id', actorId); const { data: conversation, error } = await query.maybeSingle(); fail(error); if (!conversation) return null;
  const { data: messages, error: messageError } = await client.from('support_messages').select('id,sender_user_id,body,is_internal_note,created_at').eq('conversation_id', id).order('created_at'); fail(messageError);
  const now = new Date().toISOString(); const { error: readError } = await client.from('support_conversations').update(staff ? { staff_last_read_at: now } : { customer_last_read_at: now }).eq('id', id); fail(readError);
  if (staff) { const { error: notificationError } = await client.from('internal_notifications').update({ read_at: now }).eq('support_conversation_id', id).eq('recipient_user_id', actorId).is('read_at', null); fail(notificationError); }
  return mapConversation(conversation as Row, actorId, staff, (messages || []) as Row[]);
};

export const createSupportConversation = async (input: { customerId: string; subject: unknown; category: unknown; body: unknown }, actor: AuditActor) => {
  const subject = text(input.subject, 180); const body = text(input.body, 4000); const category = String(input.category || 'general'); if (!uuid(input.customerId) || subject.length < 2 || !body || !categories.includes(category as SupportCategory)) throw new Error('invalid_input');
  const client = getSupabaseAdmin(); const { data: conversation, error } = await client.from('support_conversations').insert({ customer_user_id: input.customerId, subject, category }).select('id').single(); fail(error); if (!conversation) throw new Error('database_error'); const { error: messageError } = await client.from('support_messages').insert({ conversation_id: conversation.id, sender_user_id: input.customerId, body }); fail(messageError);
  await writeSecurityAudit({ actor, action: 'support_conversation.created', objectType: 'support_conversation', objectId: String(conversation.id), metadata: { category } }); return String(conversation.id);
};

export const sendSupportMessage = async (input: { conversationId: string; senderId: string; body: unknown; internal?: boolean; staff: boolean }, actor: AuditActor) => {
  const body = text(input.body, 4000); if (!uuid(input.conversationId) || !uuid(input.senderId) || !body) throw new Error('invalid_input'); const current = await getSupportConversation(input.conversationId, input.senderId, input.staff); if (!current) throw new Error('not_found'); if (!input.staff && input.internal) throw new Error('forbidden');
  const { error } = await getSupabaseAdmin().from('support_messages').insert({ conversation_id: input.conversationId, sender_user_id: input.senderId, body, is_internal_note: Boolean(input.internal) }); fail(error); await writeSecurityAudit({ actor, action: input.internal ? 'support_note.created' : 'support_message.sent', objectType: 'support_conversation', objectId: input.conversationId, metadata: { internal: Boolean(input.internal) } });
};

export const updateSupportConversation = async (id: string, input: { status?: unknown; priority?: unknown; assignedTo?: unknown }, actor: AuditActor) => {
  if (!uuid(id)) throw new Error('not_found'); const update: Row = {}; if (input.status !== undefined) { const status = String(input.status); if (!statuses.includes(status as SupportStatus)) throw new Error('invalid_input'); update.status = status; } if (input.priority !== undefined) { const priority = String(input.priority); if (!priorities.includes(priority as SupportPriority)) throw new Error('invalid_input'); update.priority = priority; } if (input.assignedTo !== undefined) { const assignedTo = String(input.assignedTo || ''); if (assignedTo && !uuid(assignedTo)) throw new Error('invalid_input'); update.assigned_to = assignedTo || null; }
  if (!Object.keys(update).length) return; const { error } = await getSupabaseAdmin().from('support_conversations').update(update).eq('id', id); fail(error); await writeSecurityAudit({ actor, action: 'support_conversation.updated', objectType: 'support_conversation', objectId: id, metadata: update });
};

export const listSupportAssignees = async () => {
  const client = getSupabaseAdmin(); const { data, error } = await client.from('user_roles').select('user_id,role').in('role', ['super_admin', 'admin', 'support']); fail(error); const ids = [...new Set(((data || []) as Row[]).map((row) => String(row.user_id)))]; const roster = await people(ids); return ids.map((id) => ({ id, name: roster.get(id)?.name || 'MyGrowise-team', email: roster.get(id)?.email || '' })).sort((a, b) => a.name.localeCompare(b.name));
};
