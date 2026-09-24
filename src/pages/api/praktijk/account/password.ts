import type { APIRoute } from 'astro';
import { SUPABASE_SESSION_COOKIE, isTrustedFormOrigin, verifyCurrentPassword } from '../../../../lib/adminAuth';
import { revokeAllUserSessions, updateOwnPassword } from '../../../../lib/supabase/accounts';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData(); const currentPassword = String(form.get('current_password') || ''); const nextPassword = String(form.get('new_password') || '');
  if (!await verifyCurrentPassword(user.email, currentPassword)) return new Response(null, { status: 303, headers: { location: '/praktijk/account?password_error=current' } });
  if (nextPassword !== String(form.get('confirm_password') || '')) return new Response(null, { status: 303, headers: { location: '/praktijk/account?password_error=match' } });
  try { await updateOwnPassword(user.sub, nextPassword); await revokeAllUserSessions(user.sub); cookies.delete(SUPABASE_SESSION_COOKIE, { path: '/' }); return new Response(null, { status: 303, headers: { location: '/praktijk/login?password_saved=1' } }); }
  catch { return new Response(null, { status: 303, headers: { location: '/praktijk/account?password_error=weak' } }); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
