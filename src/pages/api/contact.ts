import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../lib/adminAuth';
import {queueWebsiteMail,deliverWebsiteMail,websiteMailReady} from '../../lib/commerce/websiteMail';
import { rateLimitSupport } from '../../lib/supportMail';

export const prerender = false;
const allowed = new Set(['Bestelling','Module','Afspraak','Profiel']);
const clean = (value: FormDataEntryValue | null, max: number) => String(value || '').replace(/\u0000/g, '').trim().slice(0,max);
const location = (request: Request, query: string) => Response.redirect(new URL(`/contact?${query}#formulier`, request.url), 303);

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  if (!websiteMailReady()) return location(request, 'error=unavailable');
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
    await queueWebsiteMail('contact',{email,name,category,body},submissionKey);
    try { await deliverWebsiteMail(5); } catch { /* The durable task remains queued. */ }
    return location(request, 'sent=1');
  } catch (error) {
    console.error('[contact] Submission unavailable', { requestId: locals.requestId, code: error instanceof Error ? error.message : 'unknown' });
    return location(request, 'error=unavailable');
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
