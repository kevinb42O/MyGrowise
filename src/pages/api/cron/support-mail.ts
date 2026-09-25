import type { APIRoute } from 'astro';
import { deliverSupportMail } from '../../../lib/supportMail';
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Geen toegang.', { status: 401 });
  try { const result = await deliverSupportMail(20); return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
  catch { return new Response('Verzending tijdelijk niet beschikbaar.', { status: 503 }); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
