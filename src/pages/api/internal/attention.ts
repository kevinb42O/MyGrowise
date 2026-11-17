import type { APIRoute } from 'astro';
import { getAdminAttention } from '../../../lib/adminAttention';
import { hasPermission } from '../../../lib/adminAuth';

export const prerender = false;
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.currentUser;
  const surface = url.searchParams.get('surface') === 'practice' ? 'practice' : 'admin';
  const headers = { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8' };
  if (!user) return Response.json({ error: 'Niet aangemeld.' }, { status: 401, headers });
  if (surface === 'practice' ? !user.roles.includes('practitioner') || !user.practitionerId : !hasPermission(user, 'internal_messages.read')) {
    return Response.json({ error: 'Geen toegang.' }, { status: 403, headers });
  }
  try { return Response.json(await getAdminAttention(user, surface, locals.requestId), { headers }); }
  catch { return Response.json({ error: 'Aandachtspunten konden niet worden geladen.' }, { status: 503, headers }); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405, headers: { Allow: 'GET' } });
