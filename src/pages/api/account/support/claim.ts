import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { getGuestConversationId, SUPPORT_GUEST_COOKIE } from '../../../../lib/supportGuest';
import { getSupabaseAdmin } from '../../../../lib/supabase/server';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = await getGuestConversationId(cookies.get(SUPPORT_GUEST_COOKIE)?.value);
  if (!id || !locals.currentUser?.emailConfirmed) return Response.redirect(new URL('/berichten/gesprek?error=invalid',request.url),303);
  const { data, error } = await getSupabaseAdmin().rpc('claim_guest_support_conversation',{ p_id: id, p_customer_id: locals.currentUser.sub });
  if (error || data !== true) return Response.redirect(new URL('/berichten/gesprek?error=invalid',request.url),303);
  cookies.delete(SUPPORT_GUEST_COOKIE,{path:'/'});
  return Response.redirect(new URL(`/account/ondersteuning?conversation=${id}`,request.url),303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
