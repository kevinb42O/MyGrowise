import type { APIRoute } from 'astro';
import { isTrustedFormOrigin, verifyCurrentPassword } from '../../../../lib/adminAuth';
import { updateOwnEmail } from '../../../../lib/supabase/accounts';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData();
  if (!await verifyCurrentPassword(user.email, String(form.get('current_password') || ''))) return new Response(null, { status: 303, headers: { location: '/praktijk/account?email_error=1' } });
  try { await updateOwnEmail(user.sub, String(form.get('email') || '')); return new Response(null, { status: 303, headers: { location: '/praktijk/account?email_saved=1' } }); }
  catch (error) { const code = error instanceof Error && error.message === 'email_taken' ? 'email_taken' : 'email_invalid'; return new Response(null, { status: 303, headers: { location: `/praktijk/account?${code}=1` } }); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
