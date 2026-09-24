import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditPatientDirectoryAccess, listPatientRecords } from '../../../../lib/clientRecords';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  try {
    const form = await request.formData();
    const search = String(form.get('search') || '').slice(0, 80);
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
