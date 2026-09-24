import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { revokeAllUserSessions } from '../../../../lib/supabase/accounts';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  await revokeAllUserSessions(locals.currentUser!.sub); cookies.delete(SUPABASE_SESSION_COOKIE, { path: '/' });
  return new Response(null, { status: 303, headers: { location: '/praktijk/login?signed_out=1&security=1' } });
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
