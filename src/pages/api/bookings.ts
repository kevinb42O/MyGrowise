import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../lib/adminAuth';
import { createBookingRequest, getPractitionerBySlug } from '../../lib/practiceStore';

export const prerender = false;
type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW = 10 * 60 * 1000;

const redirect = (slug: string, code: string) => new Response(null, { status: 303, headers: { location: `/begeleiding/${encodeURIComponent(slug)}?${code}=1` } });

export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const attempt = attempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) return new Response('Te veel aanvragen. Probeer later opnieuw.', { status: 429 });
  if (attempt && attempt.resetAt <= now) attempts.delete(ip);

  let form: FormData;
  try { form = await request.formData(); } catch { return new Response('Ongeldige aanvraag.', { status: 400 }); }
  const slug = String(form.get('practitioner') || '').trim().toLowerCase();
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const [startsAt = '', endsAt = '', extra] = String(form.get('slot') || '').split('|');
  const practitioner = await getPractitionerBySlug(slug);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
  if (!practitioner || name.length < 2 || name.length > 100 || !validEmail || extra || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt))) return redirect(slug || 'onbekend', 'error');

  try {
    await createBookingRequest(practitioner.slug, name, email, startsAt, endsAt);
    attempts.delete(ip);
    return redirect(slug, 'requested');
  } catch {
    const current = attempts.get(ip);
    attempts.set(ip, { count: (current?.count || 0) + 1, resetAt: current?.resetAt && current.resetAt > now ? current.resetAt : now + WINDOW });
    return redirect(slug, 'unavailable');
  }
};

export const GET: APIRoute = () => new Response(JSON.stringify({ error: 'Methode niet toegestaan.' }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8' } });
