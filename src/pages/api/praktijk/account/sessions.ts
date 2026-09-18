import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { revokeAllUserSessions } from '../../../../lib/practiceDb';

export const prerender = false;
export const POST: APIRoute = ({ request, cookies, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  revokeAllUserSessions(locals.currentUser!.sub); cookies.delete(ADMIN_COOKIE, { path: '/' });
  return new Response(null, { status: 303, headers: { location: '/admin/login?signed_out=1&security=1' } });
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
