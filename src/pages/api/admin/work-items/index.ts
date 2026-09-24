import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { createAdminTask } from '../../../../lib/adminWorkItems';
import { auditActor } from '../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const actor = locals.adminUser;
  if (!actor?.sub) return new Response('Niet aangemeld.', { status: 401 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.redirect(new URL('/admin/instellingen?actie=invalid#acties', request.url), 303); }
  try {
    await createAdminTask({
      title: String(form.get('title') || ''), category: String(form.get('category') || ''),
      priority: Number(form.get('priority')), dueOn: String(form.get('due_on') || ''),
      assignedTo: String(form.get('assigned_to') || ''),
    }, auditActor(actor, locals.requestId, '/api/admin/work-items'));
    return Response.redirect(new URL('/admin/instellingen?actie=created#acties', request.url), 303);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const result = code === 'invalid_input' || code === 'invalid_assignee' ? 'invalid' : 'failed';
    return Response.redirect(new URL(`/admin/instellingen?actie=${result}#acties`, request.url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
