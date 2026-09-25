import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { getSupabaseAdmin } from '../../../lib/supabase/server';
import { deliverSupportMail, queueGuestAccessEmail, rateLimitSupport, supportMailReady } from '../../../lib/supportMail';
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const email = String(form.get('email') || '').trim().toLowerCase(); const reference = String(form.get('reference') || '').trim().toUpperCase();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    if (supportMailReady() && email.length <= 254 && /^[0-9A-F]{10}$/.test(reference)
      && await rateLimitSupport('access-link-ip', ip, 8, 3600)
      && await rateLimitSupport('access-link-ref', reference, 3, 3600)) {
      const { data } = await getSupabaseAdmin().from('support_conversations').select('id').eq('public_reference', reference).eq('guest_email', email).maybeSingle();
      if (data) { await queueGuestAccessEmail(String(data.id)); try { await deliverSupportMail(3); } catch { /* queued for retry */ } }
    }
  } catch { /* Keep response neutral. */ }
  return Response.redirect(new URL('/berichten/gesprek?requested=1', request.url),303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
