import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, adminCookieOptions, createUserSession, isTrustedFormOrigin, verifyUserPassword } from '../../../../lib/adminAuth';
import { getUserById, updateOwnEmail } from '../../../../lib/practiceDb';

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const user = locals.currentUser!; const form = await request.formData(); const current = getUserById(user.sub)!;
  if (!verifyUserPassword(current, String(form.get('current_password') || ''))) return new Response(null, { status: 303, headers: { location: '/praktijk/account?email_error=1' } });
  try { const updated = updateOwnEmail(user.sub, user.practitionerId!, String(form.get('email') || '')); cookies.set(ADMIN_COOKIE, createUserSession(updated), adminCookieOptions()); return new Response(null, { status: 303, headers: { location: '/praktijk/account?email_saved=1' } }); }
  catch (error) { const code = error instanceof Error && error.message === 'email_taken' ? 'email_taken' : 'email_invalid'; return new Response(null, { status: 303, headers: { location: `/praktijk/account?${code}=1` } }); }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
