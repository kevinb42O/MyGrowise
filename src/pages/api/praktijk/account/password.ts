import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, adminCookieOptions, createPasswordCredential, createUserSession, isTrustedFormOrigin, verifyUserPassword } from '../../../../lib/adminAuth';
import { getUserById, updateOwnPassword } from '../../../../lib/practiceDb';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData(); const currentPassword = String(form.get('current_password') || ''); const nextPassword = String(form.get('new_password') || '');
  if (!verifyUserPassword(getUserById(user.sub)!, currentPassword)) return new Response(null, { status: 303, headers: { location: '/praktijk/account?password_error=current' } });
  if (nextPassword !== String(form.get('confirm_password') || '')) return new Response(null, { status: 303, headers: { location: '/praktijk/account?password_error=match' } });
  try { const credential = createPasswordCredential(nextPassword); const updated = updateOwnPassword(user.sub, credential.salt, credential.hash); cookies.set(ADMIN_COOKIE, createUserSession(updated), adminCookieOptions()); return new Response(null, { status: 303, headers: { location: '/praktijk/account?password_saved=1' } }); }
  catch { return new Response(null, { status: 303, headers: { location: '/praktijk/account?password_error=weak' } }); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
