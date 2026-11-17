import type { APIRoute } from 'astro';
import { getUnreadNotifications, markNotificationsRead } from '../../../lib/internalMessaging';
import { isTrustedFormOrigin, hasPermission } from '../../../lib/adminAuth';

export const prerender = false;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } });

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.currentUser) return json({ error: 'Niet aangemeld.' }, 401);
  const checkedAt = new Date().toISOString();
  try { return json({ ...await getUnreadNotifications(locals.currentUser.sub, hasPermission(locals.currentUser, 'support.read')), checkedAt }); }
  catch { return json({ error: 'Notificaties konden niet worden geladen.' }, 502); }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.currentUser) return json({ error: 'Niet aangemeld.' }, 401);
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'Ongeldige aanvraag.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Ongeldige aanvraag.' }, 400);
  const input = body as { ids?: unknown; all?: unknown; before?: unknown };
  const selected = Array.isArray(input.ids) && input.ids.length <= 100 && input.ids.every(uuid);
  const all = input.all === true && input.ids === undefined;
  if ((!selected && !all) || (selected && input.all !== undefined)) return json({ error: 'Kies meldingen of expliciet alles gelezen.' }, 400);
  const now = new Date().toISOString();
  if (input.before !== undefined && (typeof input.before !== 'string' || !Number.isFinite(Date.parse(input.before)) || Date.parse(input.before) > Date.parse(now))) return json({ error: 'Ongeldig leestijdstip.' }, 400);
  try {
    await markNotificationsRead(locals.currentUser.sub, selected ? input.ids as string[] : undefined, input.before as string | undefined || now);
    return json({ ok: true });
  } catch { return json({ error: 'Notificaties konden niet worden bijgewerkt.' }, 502); }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405, headers: { Allow: 'GET, POST' } });
