import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { getSupabaseAdmin } from '../../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = String(params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return new Response('Bestelling niet gevonden.', { status: 404 });
  const actor = locals.adminUser;
  if (!actor?.sub) return new Response('Niet aangemeld.', { status: 401 });
  const { error } = await getSupabaseAdmin().rpc('confirm_wise_manual_payment', { p_order_id: id, p_actor_id: actor.sub });
  if (error) return Response.redirect(new URL('/admin/bestellingen?melding=fout', request.url), 303);
  return Response.redirect(new URL('/admin/bestellingen?melding=bevestigd', request.url), 303);
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
