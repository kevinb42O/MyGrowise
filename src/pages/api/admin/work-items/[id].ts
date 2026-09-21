import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { getSupabaseAdmin } from '../../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = params.id || '';
  const form = await request.formData();
  const status = String(form.get('status') || '');
  if (!['open', 'in_progress', 'blocked', 'resolved'].includes(status)) return new Response('Ongeldige status.', { status: 400 });
  const { data, error } = await getSupabaseAdmin().from('admin_work_items').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', id).select('id,title').maybeSingle();
  if (error) return new Response('Opslaan is niet gelukt.', { status: 502 });
  if (!data) return new Response('Werkitem niet gevonden.', { status: 404 });
  await getSupabaseAdmin().from('security_audit_log').insert({ action: 'admin_work_item.status_changed', object_type: 'admin_work_item', object_id: id, metadata: { title: data.title, status, actor: locals.adminUser?.email || 'unknown' } });
  return new Response(null, { status: 303, headers: { location: '/admin/instellingen?message=work-item-updated' } });
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
