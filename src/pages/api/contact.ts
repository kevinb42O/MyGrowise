import type { APIRoute } from 'astro';
import { isCustomerAccount, isTrustedFormOrigin } from '../../lib/adminAuth';
import { createSupportConversation } from '../../lib/supportInbox';
import { getSupabaseAdmin } from '../../lib/supabase/server';
import { deliverSupportMail, rateLimitSupport, supportMailReady } from '../../lib/supportMail';
import { auditActor } from '../../lib/securityAudit';

export const prerender = false;
const allowed = new Set(['general','order','access','booking','privacy','other','collaboration']);
const clean = (value: FormDataEntryValue | null, max: number) => String(value || '').replace(/\u0000/g, '').trim().slice(0,max);
const location = (request: Request, query: string) => Response.redirect(new URL(`/contact?${query}#formulier`, request.url), 303);

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  if (!supportMailReady()) return location(request, 'error=unavailable');
  const form = await request.formData();
  if (clean(form.get('website'), 100)) return location(request, 'sent=1');
  const category = clean(form.get('category'), 40); const body = clean(form.get('body'), 4001);
  const name = clean(form.get('name'), 101) || 'Bezoeker';
  const email = clean(form.get('email'), 255).toLowerCase();
  const submissionKey = clean(form.get('submission_key'), 50);
  if (!allowed.has(category) || !body || body.length > 4000 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^[0-9a-f-]{36}$/i.test(submissionKey)) return location(request, 'error=invalid');
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!await rateLimitSupport('contact-ip', ip, 8, 3600) || !await rateLimitSupport('contact-email', email, 4, 3600)) return location(request, 'error=limited');
    if (isCustomerAccount(locals.currentUser)) {
      if (!locals.currentUser!.emailConfirmed) return location(request, 'error=verify');
      const id = await createSupportConversation({ customerId: locals.currentUser!.sub, subject: `Vraag over ${category}`, category, body }, auditActor(locals.currentUser, locals.requestId, '/api/contact'));
      return Response.redirect(new URL(`/account/ondersteuning?conversation=${id}&created=1`, request.url), 303);
    }
    const { data, error } = await getSupabaseAdmin().rpc('create_guest_support_conversation', { p_email: email, p_name: name, p_category: category, p_body: body, p_submission_key: submissionKey });
    if (error || !Array.isArray(data) || !data[0]) throw new Error('guest_create_failed');
    try { await deliverSupportMail(5); } catch { /* Durable mail job remains queued. */ }
    return location(request, `sent=1&ref=${encodeURIComponent(String(data[0].reference))}`);
  } catch (error) {
    console.error('[contact] Submission unavailable', { requestId: locals.requestId, code: error instanceof Error ? error.message : 'unknown' });
    return location(request, 'error=unavailable');
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
