import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type Row = Record<string, any>;
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'database_error'); };
const text = (value: unknown, max: number) => String(value || '').replace(/\u0000/g, '').trim().replace(/\r\n/g, '\n').slice(0, max);
const statuses = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const;
const priorities = ['low', 'normal', 'high', 'urgent'] as const;
const categories = ['general', 'order', 'access', 'booking', 'privacy', 'other', 'collaboration'] as const;
export type SupportStatus = typeof statuses[number]; export type SupportPriority = typeof priorities[number]; export type SupportCategory = typeof categories[number];
export type SupportMessage = { id: string; senderId: string; senderType: 'customer' | 'guest' | 'staff'; senderName: string; body: string; internal: boolean; createdAt: string };
export type SupportConversation = { id: string; customerId: string; customerName: string; customerEmail: string; guest: boolean; guestVerified: boolean; reference: string | null; subject: string; category: SupportCategory; status: SupportStatus; priority: SupportPriority; assignedTo: string | null; assignedName: string | null; lastMessageAt: string; preview: string; unread: boolean; messages?: SupportMessage[] };

const people = async (ids: string[]) => {
  const unique = [...new Set(ids.filter(uuid))]; if (!unique.length) return new Map<string, { name: string; email: string }>();
  const client = getSupabaseAdmin(); const { data: profiles, error: profileError } = await client.from('profiles').select('id,full_name').in('id', unique);
  fail(profileError);
  const profileMap = new Map(((profiles || []) as Row[]).map((item) => [String(item.id), String(item.full_name || '')]));
  const users = await Promise.all(unique.map(async (id) => { const { data, error } = await client.auth.admin.getUserById(id); if (error) throw new Error('contacts_unavailable'); return data.user; }));
  return new Map(users.filter(Boolean).map((item) => [item!.id, { name: profileMap.get(item!.id) || String(item!.user_metadata?.full_name || item!.email || 'MyGrowise-klant'), email: item!.email || '' }]));
};

const mapConversation = async (row: Row, currentUserId: string, staff: boolean, messageRows: Row[] = []): Promise<SupportConversation> => {
  const ids = [String(row.customer_user_id), row.assigned_to ? String(row.assigned_to) : '', ...messageRows.map((message) => String(message.sender_user_id))];
  const names = await people(ids); const visible = staff ? messageRows : messageRows.filter((message) => !message.is_internal_note);
  const latest = visible[0]; const lastRead = staff ? row.staff_last_read_at : row.customer_last_read_at;
  const otherMessage = visible.find((message) => staff ? message.sender_type !== 'staff' : message.sender_type === 'staff');
  const guest = Boolean(row.guest_email);
  return { id: String(row.id), customerId: row.customer_user_id ? String(row.customer_user_id) : '', customerName: guest ? String(row.guest_name || 'Bezoeker') : names.get(String(row.customer_user_id))?.name || 'Klant', customerEmail: guest ? String(row.guest_email) : names.get(String(row.customer_user_id))?.email || '', guest, guestVerified: Boolean(row.guest_verified_at), reference: row.public_reference ? String(row.public_reference) : null, subject: String(row.subject), category: row.category as SupportCategory, status: row.status as SupportStatus, priority: row.priority as SupportPriority, assignedTo: row.assigned_to ? String(row.assigned_to) : null, assignedName: row.assigned_to ? names.get(String(row.assigned_to))?.name || null : null, lastMessageAt: String(row.last_message_at), preview: latest ? text(latest.body, 140) : '', unread: Boolean(otherMessage && (!lastRead || new Date(otherMessage.created_at).getTime() > new Date(lastRead).getTime())), messages: visible.length ? visible.slice().reverse().map((message) => ({ id: String(message.id), senderId: message.sender_user_id ? String(message.sender_user_id) : 'guest', senderType: String(message.sender_type) as SupportMessage['senderType'], senderName: message.sender_type === 'guest' ? String(row.guest_name || 'Bezoeker') : names.get(String(message.sender_user_id))?.name || 'MyGrowise', body: String(message.body), internal: Boolean(message.is_internal_note), createdAt: String(message.created_at) })) : undefined };
};

export const listSupportConversations = async (actorId: string, staff: boolean, page = 1): Promise<{ items: SupportConversation[]; hasMore: boolean }> => {
  const pageSize = 30;
  const safePage = Math.max(1, Math.min(1000, Math.floor(page) || 1));
  const start = (safePage - 1) * pageSize;
  const client = getSupabaseAdmin();
  const query = client.from('support_conversation_summaries').select('*').order('last_message_at', { ascending: false }).order('id', { ascending: false }).range(start, start + pageSize);
  const { data, error } = staff ? await query : await query.eq('customer_user_id', actorId);
  fail(error);
  const rows = (data || []) as Row[];
  const roster = await people(rows.flatMap((row) => [String(row.customer_user_id || ''), String(row.assigned_to || '')]));
  const items = rows.slice(0, pageSize).map((row): SupportConversation => {
    const guest = Boolean(row.guest_email);
    const customer = roster.get(String(row.customer_user_id));
    const assigned = roster.get(String(row.assigned_to));
    const lastOther = staff ? row.last_customer_message_at : row.last_staff_message_at;
    const lastRead = staff ? row.staff_last_read_at : row.customer_last_read_at;
    return {
      id: String(row.id), customerId: row.customer_user_id ? String(row.customer_user_id) : '',
      customerName: guest ? String(row.guest_name || 'Bezoeker') : customer?.name || 'Klant',
      customerEmail: guest ? String(row.guest_email) : customer?.email || '', guest,
      guestVerified: Boolean(row.guest_verified_at), reference: row.public_reference ? String(row.public_reference) : null,
      subject: String(row.subject), category: row.category as SupportCategory, status: row.status as SupportStatus,
      priority: row.priority as SupportPriority, assignedTo: row.assigned_to ? String(row.assigned_to) : null,
      assignedName: assigned?.name || null, lastMessageAt: String(row.last_message_at),
      preview: text(row.preview_body, 140),
      unread: Boolean(lastOther && (!lastRead || new Date(lastOther).getTime() > new Date(lastRead).getTime()))
    };
  });
  return { items, hasMore: rows.length > pageSize };
};

export const getSupportConversation = async (id: string, actorId: string, staff: boolean): Promise<SupportConversation | null> => {
  if (!uuid(id)) return null; const client = getSupabaseAdmin(); let query = client.from('support_conversations').select('id,customer_user_id,guest_email,guest_name,guest_verified_at,public_reference,subject,category,status,priority,assigned_to,last_message_at,customer_last_read_at,staff_last_read_at').eq('id', id); if (!staff) query = query.eq('customer_user_id', actorId); const { data: conversation, error } = await query.maybeSingle(); fail(error); if (!conversation) return null;
  const { data: messages, error: messageError } = await client.from('support_messages').select('id,sender_user_id,sender_type,body,is_internal_note,created_at').eq('conversation_id', id).order('created_at'); fail(messageError);
  const now = new Date().toISOString(); const { error: readError } = await client.from('support_conversations').update(staff ? { staff_last_read_at: now } : { customer_last_read_at: now }).eq('id', id); fail(readError);
  if (staff) { const { error: notificationError } = await client.from('internal_notifications').update({ read_at: now }).eq('support_conversation_id', id).eq('recipient_user_id', actorId).is('read_at', null); fail(notificationError); }
  return mapConversation({ ...conversation, [staff ? 'staff_last_read_at' : 'customer_last_read_at']: now } as Row, actorId, staff, ((messages || []) as Row[]).slice().reverse());
};

export const createSupportConversation = async (input: { customerId: string; subject: unknown; category: unknown; body: unknown }, actor: AuditActor) => {
  const subject = text(input.subject, 180); const body = text(input.body, 4000); const category = String(input.category || 'general'); if (!uuid(input.customerId) || subject.length < 2 || !body || !categories.includes(category as SupportCategory)) throw new Error('invalid_input');
  const client = getSupabaseAdmin(); const { data: id, error } = await client.rpc('create_customer_support_conversation', { p_customer_id: input.customerId, p_subject: subject, p_category: category, p_body: body }); fail(error);
  await writeSecurityAudit({ actor, action: 'support_conversation.created', objectType: 'support_conversation', objectId: String(id), metadata: { category } }); return String(id);
};

export const sendSupportMessage = async (input: { conversationId: string; senderId: string; body: unknown; internal?: boolean; staff: boolean }, actor: AuditActor) => {
  const body = text(input.body, 4000); if (!uuid(input.conversationId) || !uuid(input.senderId) || !body) throw new Error('invalid_input'); const current = await getSupportConversation(input.conversationId, input.senderId, input.staff); if (!current) throw new Error('not_found'); if (!input.staff && input.internal) throw new Error('forbidden');
  const { error } = await getSupabaseAdmin().from('support_messages').insert({ conversation_id: input.conversationId, sender_user_id: input.senderId, sender_type: input.staff ? 'staff' : 'customer', body, is_internal_note: Boolean(input.internal) }); fail(error); await writeSecurityAudit({ actor, action: input.internal ? 'support_note.created' : 'support_message.sent', objectType: 'support_conversation', objectId: input.conversationId, metadata: { internal: Boolean(input.internal) } });
};

export const updateSupportConversation = async (id: string, input: { status?: unknown; priority?: unknown; assignedTo?: unknown }, actor: AuditActor) => {
  if (!uuid(id)) throw new Error('not_found'); const update: Row = {}; if (input.status !== undefined) { const status = String(input.status); if (!statuses.includes(status as SupportStatus)) throw new Error('invalid_input'); update.status = status; } if (input.priority !== undefined) { const priority = String(input.priority); if (!priorities.includes(priority as SupportPriority)) throw new Error('invalid_input'); update.priority = priority; } if (input.assignedTo !== undefined) { const assignedTo = String(input.assignedTo || ''); if (assignedTo && !uuid(assignedTo)) throw new Error('invalid_input'); update.assigned_to = assignedTo || null; }
  if (!Object.keys(update).length) return; const { error } = await getSupabaseAdmin().from('support_conversations').update(update).eq('id', id); fail(error); await writeSecurityAudit({ actor, action: 'support_conversation.updated', objectType: 'support_conversation', objectId: id, metadata: update });
};

export const listSupportAssignees = async () => {
  const client = getSupabaseAdmin(); const { data, error } = await client.from('user_roles').select('user_id,role').in('role', ['super_admin', 'admin', 'support']); fail(error); const ids = [...new Set(((data || []) as Row[]).map((row) => String(row.user_id)))]; const roster = await people(ids); return ids.map((id) => ({ id, name: roster.get(id)?.name || 'MyGrowise-team', email: roster.get(id)?.email || '' })).sort((a, b) => a.name.localeCompare(b.name));
};

export const countUnreadCustomerSupport = async (customerId: string) => {
  if (!uuid(customerId)) return 0;
  const { data, error } = await getSupabaseAdmin().rpc('count_unread_support_conversations', { p_customer_id: customerId });
  fail(error);
  return Number(data || 0);
};
