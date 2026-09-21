import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, SUPABASE_ADMIN_COOKIE, isTrustedFormOrigin } from '../../../lib/adminAuth';

export const prerender = false;

export const POST: APIRoute = ({ request, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  cookies.delete(ADMIN_COOKIE, { path: '/' });
  cookies.delete(SUPABASE_ADMIN_COOKIE, { path: '/' });
  return new Response(null, { status: 303, headers: { location: '/admin/login?signed_out=1' } });
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
