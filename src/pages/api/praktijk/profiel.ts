import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { updatePractitionerProfile } from '../../../lib/practiceStore';

export const prerender = false;
const redirect = (path: string) => new Response(null, { status: 303, headers: { location: path } });
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData();
  try {
    await updatePractitionerProfile(user.practitionerId!, user.sub, {
      name: String(form.get('name') || ''), publicRole: String(form.get('public_role') || ''), bio: String(form.get('bio') || ''),
      expertise: String(form.get('expertise') || ''), languages: String(form.get('languages') || ''),
      appointmentDurationMinutes: form.get('appointment_duration_minutes'), minimumNoticeHours: form.get('minimum_notice_hours'), bookingHorizonDays: form.get('booking_horizon_days'), requestsEnabled: form.get('requests_enabled') === 'on',
    });
    return redirect('/praktijk/profiel?saved=1');
  } catch { return redirect('/praktijk/profiel?error=Controleer+je+profielgegevens.+Je+introductie+moet+minstens+40+tekens+zijn.'); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
