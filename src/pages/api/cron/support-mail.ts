import {deliverQueuedMail} from '../../../lib/mailWorker';
import type {APIRoute} from 'astro';
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Geen toegang.', { status: 401 });
  try { const result = await deliverQueuedMail(); return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
  catch { return new Response('Verzending tijdelijk niet beschikbaar.', { status: 503 }); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
