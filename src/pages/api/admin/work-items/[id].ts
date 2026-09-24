import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { getSupabaseAdmin } from '../../../../lib/supabase/server';
import { auditActor, writeSecurityAudit } from '../../../../lib/securityAudit';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = params.id || '';
  const form = await request.formData();
  const status = String(form.get('status') || '');
  if (!['open', 'in_progress', 'blocked', 'resolved'].includes(status)) return new Response('Ongeldige status.', { status: 400 });
  const client = getSupabaseAdmin();
  const { data: before, error: beforeError } = await client.from('admin_work_items').select('id,title,status').eq('id', id).maybeSingle();
  if (beforeError) return new Response('Werkitem kon niet worden geladen.', { status: 502 });
  if (!before) return new Response('Werkitem niet gevonden.', { status: 404 });
  const { data, error } = await client.from('admin_work_items').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', id).select('id,title,status').maybeSingle();
  if (error) return new Response('Opslaan is niet gelukt.', { status: 502 });
  if (!data) return new Response('Werkitem niet gevonden.', { status: 404 });
  await writeSecurityAudit({ actor: auditActor(locals.adminUser, locals.requestId, `/api/admin/work-items/${id}`), action: 'admin_work_item.status_changed', objectType: 'admin_work_item', objectId: id, before: { title: before.title, status: before.status }, after: { title: data.title, status: data.status } });
  return new Response(null, { status: 303, headers: { location: '/admin/instellingen?message=work-item-updated' } });
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
