import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { getNotificationPreferences, updateNotificationPreferences } from '../../../lib/supabase/accounts';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  try {
    const form = await request.formData();
    const saved = await getNotificationPreferences(locals.currentUser!.sub);
    await updateNotificationPreferences(locals.currentUser!.sub, { ...saved, bookingReminderEnabled: form.get('booking_reminder_enabled') === 'on' });
    return redirect('/account/instellingen?preferences_saved=1', 303);
  } catch {
    return redirect('/account/instellingen?preferences_error=1', 303);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
