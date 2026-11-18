import type { APIRoute } from 'astro';
import { hasPermission, isTrustedFormOrigin } from '../../../../lib/adminAuth';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals, params }) => {
  if (!isTrustedFormOrigin(request) || !hasPermission(locals.adminUser, 'content.write')) return new Response('Geen toegang.', { status: 403 });
  return Response.redirect(new URL(`/admin/content/${encodeURIComponent(params.id || '')}`, request.url), 307);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
