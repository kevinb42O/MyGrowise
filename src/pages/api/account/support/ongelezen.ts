import type { APIRoute } from 'astro';
import { countUnreadCustomerSupport } from '../../../../lib/supportInbox';
export const prerender = false;
export const GET: APIRoute = async ({ locals }) => {
  const unread = await countUnreadCustomerSupport(locals.currentUser!.sub);
  return new Response(JSON.stringify({ unread }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } });
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
