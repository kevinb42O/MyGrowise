import type { APIRoute } from 'astro';
import { updateContent, validateContentInput } from '../../../../lib/adminContent';
import { hasPermission, isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = params.id || '';
  const form = await request.formData();
  const validation = validateContentInput(form);
  if (!validation.value) return Response.redirect(new URL(`/admin/content/${encodeURIComponent(id)}?error=${encodeURIComponent(Object.values(validation.errors)[0] || 'Controleer de invoer.')}`, url), 303);
  if (!hasPermission(locals.adminUser, 'content.write') || (validation.value.status === 'published' && !hasPermission(locals.adminUser, 'content.publish'))) return new Response('Geen toegang.', { status: 403 });
  try {
    await updateContent(id, validation.value, auditActor(locals.adminUser, locals.requestId, `/api/admin/content/${id}`));
    return Response.redirect(new URL(`/admin/content/${encodeURIComponent(id)}?saved=1`, url), 303);
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') return new Response('Content niet gevonden.', { status: 404 });
    const message = error instanceof Error && error.message === 'duplicate_slug' ? 'Deze slug bestaat al.' : 'Opslaan is niet gelukt.';
    return Response.redirect(new URL(`/admin/content/${encodeURIComponent(id)}?error=${encodeURIComponent(message)}`, url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
