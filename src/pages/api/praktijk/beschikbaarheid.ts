import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { saveAvailabilityRules, type AvailabilityRule } from '../../../lib/practiceStore';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!;
  const form = await request.formData();
  const rules: AvailabilityRule[] = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    if (form.get(`enabled_${weekday}`) !== 'on') continue;
    const starts = form.getAll(`start_${weekday}`).map(String);
    const ends = form.getAll(`end_${weekday}`).map(String);
    if (starts.length !== ends.length) return new Response(null, { status: 303, headers: { location: '/praktijk/beschikbaarheid?error=Controleer+alle+gekozen+tijdsblokken.' } });
    starts.forEach((startTime, index) => rules.push({ weekday, startTime, endTime: ends[index] }));
  }
  try {
    saveAvailabilityRules(user.practitionerId!, user.sub, rules);
    return new Response(null, { status: 303, headers: { location: '/praktijk/beschikbaarheid?saved=1' } });
  } catch {
    return new Response(null, { status: 303, headers: { location: '/praktijk/beschikbaarheid?error=Controleer+de+gekozen+begin-+en+eindtijden.' } });
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
