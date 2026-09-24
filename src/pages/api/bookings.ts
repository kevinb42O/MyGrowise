import type { APIRoute } from 'astro';
import { isCustomerAccount, isTrustedFormOrigin } from '../../lib/adminAuth';
import { createBookingRequest, getPractitionerBySlug } from '../../lib/practiceStore';

export const prerender = false;

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW = 10 * 60 * 1000;
let lastSweepAt = 0;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const redirect = (slug: string, code: string) => new Response(null, {
  status: 303,
  headers: { location: `/begeleiding/${encodeURIComponent(slug)}?${code}=1`, 'cache-control': 'no-store' },
});

const loginRedirect = (request: Request, slug: string, error: 'customer_required' | 'email_confirmation' | 'session_expired') => {
  const next = slugPattern.test(slug) ? `/begeleiding/${slug}` : '/account';
  const destination = new URL('/account/inloggen', request.url);
  destination.searchParams.set('next', next);
  destination.searchParams.set('error', error);
  return new Response(null, { status: 303, headers: { location: `${destination.pathname}${destination.search}`, 'cache-control': 'no-store' } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });

  let form: FormData;
  try { form = await request.formData(); } catch { return new Response('Ongeldige aanvraag.', { status: 400 }); }

  const slug = String(form.get('practitioner') || '').trim().toLowerCase();
  const user = locals.currentUser;
  if (!user) return loginRedirect(request, slug, 'session_expired');
  if (!isCustomerAccount(user)) return loginRedirect(request, slug, 'customer_required');
  if (!user.emailConfirmed) return loginRedirect(request, slug, 'email_confirmation');

  const key = user.sub;
  const now = Date.now();
  if (now - lastSweepAt > 60_000) {
    for (const [attemptKey, attempt] of attempts) if (attempt.resetAt <= now) attempts.delete(attemptKey);
    lastSweepAt = now;
  }
  const previous = attempts.get(key);
  if (previous && previous.resetAt > now && previous.count >= 5) {
    return new Response(null, { status: 303, headers: { location: '/account/begeleiding?error=rate_limited', 'cache-control': 'no-store' } });
  }
  if (previous && previous.resetAt <= now) attempts.delete(key);

  const submissionKey = String(form.get('submission_key') || '').trim();
  const [startsAt = '', endsAt = '', extra] = String(form.get('slot') || '').split('|');
  const practitioner = slugPattern.test(slug) ? await getPractitionerBySlug(slug) : null;
  const validSlot = !extra && Number.isFinite(Date.parse(startsAt)) && Number.isFinite(Date.parse(endsAt)) && Date.parse(endsAt) > Date.parse(startsAt);
  if (!practitioner || !uuidPattern.test(submissionKey) || !validSlot) return redirect(slug || 'onbekend', 'error');
  attempts.set(key, { count: (previous?.resetAt && previous.resetAt > now ? previous.count : 0) + 1, resetAt: previous?.resetAt && previous.resetAt > now ? previous.resetAt : now + WINDOW });

  try {
    await createBookingRequest(practitioner.slug, user.sub, startsAt, endsAt, submissionKey, locals.requestId);
    return new Response(null, { status: 303, headers: { location: '/account/begeleiding?requested=1', 'cache-control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'slot_unavailable') {
      return redirect(slug, 'unavailable');
    }
    if (code === 'customer_required') return loginRedirect(request, slug, 'customer_required');
    if (code === 'email_confirmation') return loginRedirect(request, slug, 'email_confirmation');
    if (code === 'invalid_input' || code === 'idempotency_conflict') return redirect(slug, 'error');
    console.error('[bookings.create] Request could not be created', { requestId: locals.requestId || null, code: code || 'unknown' });
    return redirect(slug, 'error');
  }
};

export const GET: APIRoute = () => new Response(JSON.stringify({ error: 'Methode niet toegestaan.' }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
