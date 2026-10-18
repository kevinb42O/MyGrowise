import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { getNotificationPreferences, updateNotificationPreferences } from '../../../../lib/supabase/accounts';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const user = locals.currentUser!;
  const saved=await getNotificationPreferences(user.sub);
  await updateNotificationPreferences(user.sub, { bookingEmailEnabled: form.get('booking_email_enabled') === 'on', bookingReminderEnabled: saved.bookingReminderEnabled, weeklyDigestEnabled: saved.weeklyDigestEnabled });
  return new Response(null, { status: 303, headers: { location: '/praktijk/account?preferences_saved=1' } });
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
