import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from './supabase/server';

type Row = Record<string, any>;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const supportMailReady = () => Boolean(import.meta.env.SUPPORT_SMTP_VERIFIED === 'true' && import.meta.env.SUPPORT_SMTP_USER?.trim() && import.meta.env.SUPPORT_SMTP_PASSWORD?.trim() && import.meta.env.SUPPORT_FROM_EMAIL?.trim());
export const supportTokenHash = digest;
const siteOrigin = () => import.meta.env.PROD ? 'https://mygrowise.be' : (import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321').replace(/\/$/, '');

export const rateLimitSupport = async (kind: string, value: string, limit: number, seconds: number) => {
  const { data, error } = await getSupabaseAdmin().rpc('support_rate_limit', { p_key_hash: digest(`${kind}:${value}`), p_limit: limit, p_window_seconds: seconds });
  if (error) throw new Error('rate_limit_unavailable');
  return data === true;
};

const makeGuestLink = async (conversationId: string) => {
  const token = randomBytes(32).toString('base64url');
  const { error } = await getSupabaseAdmin().from('support_guest_tokens').insert({
    conversation_id: conversationId, token_hash: digest(token), expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
  });
  if (error) throw new Error('token_create_failed');
  return `${siteOrigin()}/berichten/toegang?token=${encodeURIComponent(token)}`;
};

const sendEmail = async (to: string, subject: string, text: string) => {
  if (!supportMailReady()) throw new Error('mail_not_configured');
  const transport = nodemailer.createTransport({
    host: 'smtp.mail.webnode.com', port: 465, secure: true,
    auth: { user: import.meta.env.SUPPORT_SMTP_USER, pass: import.meta.env.SUPPORT_SMTP_PASSWORD },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
  });
  await transport.sendMail({ from: `MyGrowise <${import.meta.env.SUPPORT_FROM_EMAIL}>`, to, replyTo: 'info@mygrowise.be', subject, text });
};

export const queueGuestAccessEmail = async (conversationId: string) => {
  const { error } = await getSupabaseAdmin().from('support_mail_jobs').insert({ conversation_id: conversationId, kind: 'access' });
  if (error) throw new Error('mail_queue_failed');
};

export const pendingSupportMailCount = async () => {
  const { count, error } = await getSupabaseAdmin().from('support_mail_jobs').select('id', { count: 'exact', head: true }).neq('status', 'sent');
  if (error) throw new Error('mail_queue_unavailable');
  return count || 0;
};

export const deliverSupportMail = async (limit = 10) => {
  if (!supportMailReady()) return { sent: 0, failed: 0 };
  const client = getSupabaseAdmin();
  const { data: jobs, error } = await client.rpc('claim_support_mail_jobs', { p_limit: limit });
  if (error) throw new Error('mail_claim_failed');
  let sent = 0; let failed = 0;
  for (const job of (jobs || []) as Row[]) {
    try {
      const { data: conversation, error: conversationError } = await client.from('support_conversations')
        .select('id,customer_user_id,guest_email,public_reference').eq('id', job.conversation_id).single();
      if (conversationError || !conversation) throw new Error('conversation_missing');
      let recipient = String(conversation.guest_email || '');
      if (!recipient && conversation.customer_user_id) {
        const { data, error: userError } = await client.auth.admin.getUserById(String(conversation.customer_user_id));
        if (userError || !data.user?.email) throw new Error('recipient_missing');
        recipient = data.user.email;
      }
      const link = conversation.guest_email
        ? await makeGuestLink(String(conversation.id))
        : `${siteOrigin()}/account/ondersteuning?conversation=${encodeURIComponent(String(conversation.id))}`;
      const reference = conversation.public_reference ? `Referentie: ${conversation.public_reference}\n\n` : '';
      const isReply = job.kind === 'reply';
      const body = isReply
        ? `Er staat een antwoord van MyGrowise voor je klaar.\n\n${reference}Lees het antwoord en reageer veilig via:\n${link}\n\nEen antwoord op deze e-mail wordt niet automatisch aan je gesprek toegevoegd. Gebruik de link om in hetzelfde gesprek te reageren. Deel geen medische gegevens via gewone e-mail.\n\nMyGrowise`
        : `Je vraag aan MyGrowise is ontvangen.\n\n${reference}Bekijk je gesprek en onze antwoorden via:\n${link}\n\nEen antwoord op deze e-mail wordt niet automatisch aan je gesprek toegevoegd. Gebruik de link om in hetzelfde gesprek te reageren. Deel geen medische gegevens via gewone e-mail.\n\nMyGrowise`;
      await sendEmail(recipient, isReply ? 'Er staat een antwoord voor je klaar — MyGrowise' : 'Je vraag is ontvangen — MyGrowise', body);
      const { error: updateError } = await client.from('support_mail_jobs').update({ status: 'sent', sent_at: new Date().toISOString(), lease_until: null, last_error: null }).eq('id', job.id);
      if (updateError) throw new Error('mail_status_failed');
      sent++;
    } catch (cause) {
      const code = cause instanceof Error ? cause.message.slice(0, 100) : 'unknown';
      const attempts = Number(job.attempts || 1);
      await client.from('support_mail_jobs').update({ status: attempts >= 6 ? 'failed' : 'pending', next_attempt_at: new Date(Date.now() + Math.min(2 ** attempts * 60_000, 6 * 60 * 60_000)).toISOString(), lease_until: null, last_error: code }).eq('id', job.id);
      failed++;
    }
  }
  return { sent, failed };
};
