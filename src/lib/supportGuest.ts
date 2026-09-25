import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from './supabase/server';
import { supportTokenHash } from './supportMail';

export const SUPPORT_GUEST_COOKIE = 'mg_support_guest';
export const supportGuestCookieOptions = () => ({ httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict' as const, path: '/', maxAge: 7 * 24 * 60 * 60 });
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const consumeGuestAccessToken = async (token: string) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const client = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await client.from('support_guest_tokens').update({ used_at: now })
    .eq('token_hash', supportTokenHash(token)).is('used_at', null).gt('expires_at', now)
    .select('conversation_id').maybeSingle();
  if (error || !data) return null;
  const { error: verifyError } = await client.from('support_conversations').update({ guest_verified_at: now }).eq('id', data.conversation_id).not('guest_email', 'is', null);
  if (verifyError) throw new Error('guest_verify_failed');
  const session = randomBytes(32).toString('base64url');
  const { error: sessionError } = await client.from('support_guest_sessions').insert({
    conversation_id: data.conversation_id, token_hash: supportTokenHash(session), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
  });
  if (sessionError) throw new Error('guest_session_failed');
  return { conversationId: String(data.conversation_id), session };
};

export const getGuestConversationId = async (session: string | undefined) => {
  if (!session || !/^[A-Za-z0-9_-]{43}$/.test(session)) return null;
  const { data, error } = await getSupabaseAdmin().from('support_guest_sessions').select('conversation_id')
    .eq('token_hash', supportTokenHash(session)).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error || !data) return null;
  return String(data.conversation_id);
};

export const deleteGuestSession = async (session: string | undefined) => {
  if (!session || !/^[A-Za-z0-9_-]{43}$/.test(session)) return;
  await getSupabaseAdmin().from('support_guest_sessions').delete().eq('token_hash', supportTokenHash(session));
};

export const getGuestThread = async (conversationId: string) => {
  if (!uuid(conversationId)) return null;
  const client = getSupabaseAdmin();
  const { data: conversation, error } = await client.from('support_conversations').select('id,public_reference,guest_name,guest_email,status,category,customer_last_read_at').eq('id', conversationId).not('guest_email', 'is', null).maybeSingle();
  if (error || !conversation) return null;
  const { data: messages, error: messagesError } = await client.from('support_messages').select('id,body,sender_type,created_at')
    .eq('conversation_id', conversationId).eq('is_internal_note', false).order('created_at', { ascending: false }).limit(200);
  if (messagesError) throw new Error('guest_messages_unavailable');
  await client.from('support_conversations').update({ customer_last_read_at: new Date().toISOString() }).eq('id', conversationId);
  return { reference: String(conversation.public_reference), name: String(conversation.guest_name), email: String(conversation.guest_email), status: String(conversation.status), messages: (messages || []).slice().reverse().map((row) => ({ id: String(row.id), body: String(row.body), own: row.sender_type === 'guest', createdAt: String(row.created_at) })) };
};

export const sendGuestMessage = async (conversationId: string, body: string) => {
  if (!uuid(conversationId) || body.length < 1 || body.length > 4000) throw new Error('invalid_input');
  const client = getSupabaseAdmin();
  const { data: owner, error: ownerError } = await client.from('support_conversations').select('id').eq('id', conversationId).not('guest_email', 'is', null).maybeSingle();
  if (ownerError || !owner) throw new Error('not_found');
  const { error } = await client.from('support_messages').insert({ conversation_id: conversationId, sender_user_id: null, sender_type: 'guest', body });
  if (error) throw new Error('message_unavailable');
};
