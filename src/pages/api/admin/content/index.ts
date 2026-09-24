import type { APIRoute } from 'astro';
import { createContent, validateContentInput } from '../../../../lib/adminContent';
import { hasPermission, isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  const validation = validateContentInput(form);
  if (!validation.value) return Response.redirect(new URL(`/admin/content/nieuw?error=${encodeURIComponent(Object.values(validation.errors)[0] || 'Controleer de invoer.')}`, url), 303);
  if (!hasPermission(locals.adminUser, 'content.write') || (validation.value.status === 'published' && !hasPermission(locals.adminUser, 'content.publish'))) return new Response('Geen toegang.', { status: 403 });
  try {
    const content = await createContent(validation.value, auditActor(locals.adminUser, locals.requestId, '/api/admin/content'));
    return Response.redirect(new URL(`/admin/content/${content.id}?created=1`, url), 303);
  } catch (error) {
    const message = error instanceof Error && error.message === 'duplicate_slug' ? 'Deze slug bestaat al.' : 'Opslaan is niet gelukt.';
    return Response.redirect(new URL(`/admin/content/nieuw?error=${encodeURIComponent(message)}`, url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
