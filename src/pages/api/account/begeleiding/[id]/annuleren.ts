import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../../lib/adminAuth';
import { cancelOwnCustomerBooking } from '../../../../../lib/practiceDb';
export const prerender = false;
export const POST: APIRoute = ({ request, params, locals }) => { if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 }); try { cancelOwnCustomerBooking(params.id || '', locals.currentUser!.sub); return Response.redirect(new URL('/account/begeleiding?cancelled=1', request.url), 303); } catch (error) { const code = error instanceof Error && error.message === 'too_late' ? 'late' : 'invalid'; return Response.redirect(new URL(`/account/begeleiding?cancel_error=${code}`, request.url), 303); } };
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
