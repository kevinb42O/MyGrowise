import { logoutAuthSession } from '../../../lib/authSession';
import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => { if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 }); await logoutAuthSession(cookies); return new Response(null, { status: 303, headers: { location: '/admin/login?signed_out=1' } }); };
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
