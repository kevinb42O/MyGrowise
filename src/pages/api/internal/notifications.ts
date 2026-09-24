import type { APIRoute } from 'astro';
import { listUnreadNotifications, markNotificationsRead } from '../../../lib/internalMessaging';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';

export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const GET: APIRoute = async ({ locals }) => {
  try { return json({ notifications: await listUnreadNotifications(locals.currentUser?.sub || '') }); }
  catch { return json({ error: 'Notificaties konden niet worden geladen.' }, 502); }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    await markNotificationsRead(locals.currentUser?.sub || '', Array.isArray(body.ids) ? body.ids.map(String) : undefined);
    return json({ ok: true });
  } catch { return json({ error: 'Notificaties konden niet worden bijgewerkt.' }, 502); }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
