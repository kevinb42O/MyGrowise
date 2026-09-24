import type { APIRoute } from 'astro';
import { countUnreadCustomerBookingNotifications } from '../../../../lib/supabase/accounts';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const unread = await countUnreadCustomerBookingNotifications(locals.currentUser!.sub);
    return Response.json({ unread }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'notifications_unavailable' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
