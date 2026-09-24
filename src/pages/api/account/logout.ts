import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, isTrustedFormOrigin } from '../../../lib/adminAuth';
export const prerender = false;
export const POST: APIRoute = ({ request, cookies }) => { if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 }); cookies.delete(SUPABASE_SESSION_COOKIE, { path: '/' }); return Response.redirect(new URL('/account/inloggen?error=signed_out', request.url), 303); };
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
