import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { deleteGuestSession, SUPPORT_GUEST_COOKIE } from '../../../lib/supportGuest';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  await deleteGuestSession(cookies.get(SUPPORT_GUEST_COOKIE)?.value);
  cookies.delete(SUPPORT_GUEST_COOKIE, { path: '/' });
  return Response.redirect(new URL('/contact', request.url),303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
