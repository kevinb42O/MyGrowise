import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { consumeGuestAccessToken, SUPPORT_GUEST_COOKIE, supportGuestCookieOptions } from '../../../lib/supportGuest';
import { rateLimitSupport } from '../../../lib/supportMail';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const token = String(form.get('token') || '');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  try {
    if (!await rateLimitSupport('access-ip', ip, 20, 3600)) return Response.redirect(new URL('/berichten/gesprek?error=limited', request.url),303);
    const access = await consumeGuestAccessToken(token);
    if (!access) return Response.redirect(new URL('/berichten/gesprek?error=expired', request.url),303);
    cookies.set(SUPPORT_GUEST_COOKIE, access.session, supportGuestCookieOptions());
    return Response.redirect(new URL('/berichten/gesprek', request.url),303);
  } catch { return Response.redirect(new URL('/berichten/gesprek?error=unavailable', request.url),303); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
