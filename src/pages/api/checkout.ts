import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../lib/adminAuth';
import { auditActor, writeSecurityAudit } from '../../lib/securityAudit';
import { startWiseCheckout } from '../../lib/wiseCheckout';
import { getSupabaseAdmin } from '../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser;
  if (!user?.roles.includes('customer')) return new Response('Meld je eerst aan met een klantaccount.', { status: 401 });
  let form: FormData;
  try { form = await request.formData(); } catch { return new Response('Ongeldige aanvraag.', { status: 400 }); }
  const slug = String(form.get('product') || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response('Product niet beschikbaar.', { status: 404 });
  try {
    const checkout = await startWiseCheckout(user.sub, slug);
    const anonymousId = cookies.get('mg_analytics_id')?.value || '';
    if (cookies.get('mg_analytics_consent')?.value === 'granted') await getSupabaseAdmin().from('analytics_events').insert({ event_name: 'checkout_started', anonymous_id: /^[0-9a-f-]{36}$/i.test(anonymousId) ? anonymousId : null, path: `/aanbod/${slug}`, route_key: 'self', order_id: checkout.orderId, consented: true, environment: import.meta.env.PROD ? 'production' : 'preview' });
    await writeSecurityAudit({ actor: auditActor(user, locals.requestId, '/api/checkout'), action: 'checkout.wise_qr_opened', objectType: 'order', objectId: checkout.orderId, metadata: { provider: 'wise_qr', product_slug: slug, payment_reference: checkout.paymentReference } });
    return Response.redirect(checkout.paymentUrl, 303);
  } catch (error) {
    const unavailable = error instanceof Error && error.message === 'checkout_unavailable';
    return new Response(unavailable ? 'Wise-betaling is voor dit product nog niet beschikbaar.' : 'Checkout kon niet worden gestart. Probeer opnieuw.', { status: unavailable ? 409 : 500 });
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
