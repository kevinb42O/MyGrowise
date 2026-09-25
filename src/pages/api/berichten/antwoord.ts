import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { getGuestConversationId, sendGuestMessage, SUPPORT_GUEST_COOKIE } from '../../../lib/supportGuest';
import { rateLimitSupport } from '../../../lib/supportMail';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = await getGuestConversationId(cookies.get(SUPPORT_GUEST_COOKIE)?.value);
  if (!id) return Response.redirect(new URL('/berichten/gesprek?error=expired', request.url),303);
  const form = await request.formData(); const body = String(form.get('body') || '').replace(/\u0000/g,'').trim();
  try {
    if (!await rateLimitSupport('guest-reply', id, 12, 3600)) throw new Error('rate_limited');
    await sendGuestMessage(id,body);
    return Response.redirect(new URL('/berichten/gesprek?sent=1', request.url),303);
  } catch { return Response.redirect(new URL('/berichten/gesprek?error=invalid', request.url),303); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
