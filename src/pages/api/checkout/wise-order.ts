import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { createWiseManualOrder, getWiseManualDetails } from '../../../lib/wiseCheckout';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser;
  if (!user?.roles.includes('customer')) return new Response('Meld je eerst aan met een klantaccount.', { status: 401 });
  let form: FormData;
  try { form = await request.formData(); } catch { return new Response('Ongeldige aanvraag.', { status: 400 }); }
  const slug = String(form.get('product') || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response('Product niet beschikbaar.', { status: 404 });
  if (!getWiseManualDetails()) return Response.redirect(new URL(`/aanbod/${slug}?melding=niet-beschikbaar`, request.url), 303);
  try {
    const order = await createWiseManualOrder(user.sub, slug);
    return Response.redirect(new URL(`/aanbod/${slug}?order=${encodeURIComponent(order.id)}&besteld=1`, request.url), 303);
  } catch {
    return Response.redirect(new URL(`/aanbod/${slug}?melding=niet-beschikbaar`, request.url), 303);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
