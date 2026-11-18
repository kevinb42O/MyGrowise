import type { APIRoute } from 'astro';
import { hasPermission, isTrustedFormOrigin } from '../../../../lib/adminAuth';
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request) || !hasPermission(locals.adminUser, 'integrations.manage')) return new Response('Geen toegang.', { status: 403 });
  return Response.redirect(new URL('/admin/mail', request.url), 303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
