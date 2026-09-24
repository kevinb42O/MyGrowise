import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, isTrustedFormOrigin, sanitizeAppRedirect } from '../../../lib/adminAuth';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  let next = '';
  try { next = sanitizeAppRedirect((await request.formData()).get('next')); } catch { /* Logout remains available without a form body. */ }
  cookies.delete(SUPABASE_SESSION_COOKIE, { path: '/' });
  const location = new URL('/account/inloggen?error=signed_out', request.url);
  if (next) location.searchParams.set('next', next);
  return new Response(null, { status: 303, headers: { location: `${location.pathname}${location.search}` } });
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
