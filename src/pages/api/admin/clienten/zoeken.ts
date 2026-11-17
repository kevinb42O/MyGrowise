import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditPatientDirectoryAccess, listPatientRecords } from '../../../../lib/clientRecords';
import { getSupabaseAdmin } from '../../../../lib/supabase/server';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  try {
    const form = await request.formData();
    const search = String(form.get('search') || '').slice(0, 80);
    if (form.get('compact') === '1') {
      await auditPatientDirectoryAccess(locals.currentUser!, locals.requestId);
      const db = getSupabaseAdmin();
      if (form.get('clear_recent') === '1') {
        const { error } = await db.from('patient_recent_visits').delete().eq('user_id', locals.currentUser!.sub);
        if (error) throw error;
      }
      const { data, error } = await db.rpc('search_patient_choices', { p_actor: locals.currentUser!.sub, p_search: search.trim(), p_recent: !search.trim() });
      if (error) throw error;
      return Response.json({ clients: data || [] }, { headers: { 'cache-control': 'private, no-store' } });
    }
    const requestedStatus = String(form.get('status') || 'active');
    const status = ['active', 'archived', 'all'].includes(requestedStatus) ? requestedStatus as 'active' | 'archived' | 'all' : 'active';
    await auditPatientDirectoryAccess(locals.currentUser!, locals.requestId);
    const clients = await listPatientRecords(locals.currentUser!, search, status);
    const directoryItems = clients.map((client) => {
      const item = { ...client };
      Reflect.deleteProperty(item, 'customerUserId');
      return item;
    });
    return Response.json({ clients: directoryItems }, { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'search_unavailable' }, { status: 500, headers: { 'cache-control': 'private, no-store' } });
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
