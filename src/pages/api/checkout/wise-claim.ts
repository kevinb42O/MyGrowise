import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { getSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser;
  if (!user?.roles.includes('customer')) return new Response('Meld je eerst aan met een klantaccount.', { status: 401 });
  let form: FormData;
  try { form = await request.formData(); } catch { return new Response('Ongeldige aanvraag.', { status: 400 }); }
  const orderId = String(form.get('order') || '');
  const slug = String(form.get('product') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response('Bestelling niet gevonden.', { status: 404 });
  const { error } = await getSupabaseAdmin().rpc('claim_wise_manual_payment', { p_order_id: orderId, p_customer_id: user.sub });
  if (error) return Response.redirect(new URL(`/aanbod/${slug}?melding=niet-beschikbaar`, request.url), 303);
  return Response.redirect(new URL(`/aanbod/${slug}?order=${encodeURIComponent(orderId)}&gemeld=1`, request.url), 303);
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
