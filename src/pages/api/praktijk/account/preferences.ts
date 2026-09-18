import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { updateNotificationPreferences } from '../../../../lib/practiceDb';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const user = locals.currentUser!;
  updateNotificationPreferences(user.sub, { bookingEmailEnabled: form.get('booking_email_enabled') === 'on', bookingReminderEnabled: form.get('booking_reminder_enabled') === 'on', weeklyDigestEnabled: form.get('weekly_digest_enabled') === 'on' });
  return new Response(null, { status: 303, headers: { location: '/praktijk/account?preferences_saved=1' } });
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
