import { getSupabaseAdmin } from './supabase/server';
import { sendWebsiteEmail, websiteMailReady } from './commerce/websiteMail';
import { updateFeedbackMailContent, type UpdateFeedbackPayload } from './updateFeedbackMailContent';
export const UPDATE_FEEDBACK_RECIPIENT = 'bourguignonphotography@gmail.com';
/** Immediate after feedback; the existing daily worker is the durable fallback. */
export async function deliverUpdateFeedbackMail(limit = 2, commentId?: string) {
  if (!websiteMailReady()) return { sent: 0, failed: 0, configured: false };
  const db = getSupabaseAdmin();
  const { data: jobs, error } = await db.rpc('claim_platform_update_mail', {
    p_limit: limit,
    p_comment: commentId || null,
  });
  if (error) throw new Error('feedback_mail_claim_failed');
  let sent = 0,
    failed = 0;
  await Promise.all(
    (jobs || []).map(async (job: any) => {
      try {
        const content = updateFeedbackMailContent(job.payload as UpdateFeedbackPayload);
        await sendWebsiteEmail(
          UPDATE_FEEDBACK_RECIPIENT,
          content.subject,
          content.text,
          'info@mygrowise.be',
          `<update-feedback-${job.comment_id}@mygrowise.be>`,
          content.html,
          [],
          587,
        );
        const result = await db
          .from('platform_update_mail_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            lease_token: null,
            lease_until: null,
            last_error: null,
          })
          .eq('id', job.id)
          .eq('lease_token', job.lease_token)
          .select('id');
        if (result.error || !result.data?.length) throw new Error('feedback_mail_status_failed');
        sent++;
      } catch (cause) {
        console.error('[updates.feedback_mail]', {
          name: cause instanceof Error ? cause.name : 'unknown',
          code:
            typeof cause === 'object' && cause && 'code' in cause
              ? String(cause.code)
              : 'delivery_failed',
        });
        await db
          .from('platform_update_mail_jobs')
          .update({
            status: job.attempts >= 6 ? 'failed' : 'pending',
            next_attempt_at: new Date(
              Date.now() + Math.min(2 ** job.attempts * 60000, 21600000),
            ).toISOString(),
            lease_token: null,
            lease_until: null,
            last_error: 'delivery_failed',
          })
          .eq('id', job.id)
          .eq('lease_token', job.lease_token);
        failed++;
      }
    }),
  );
  return { sent, failed, configured: true };
}
