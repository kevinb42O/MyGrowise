import type { APIRoute } from 'astro';
import { createStaffUser, type StaffRole } from '../../../lib/adminUsers';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';

export const prerender = false;
const redirect = (message: string) => new Response(null, { status: 303, headers: { location: `/admin/gebruikers?message=${encodeURIComponent(message)}` } });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  try {
    await createStaffUser({ email: String(form.get('email') || ''), fullName: String(form.get('full_name') || ''), temporaryPassword: String(form.get('temporary_password') || ''), role: String(form.get('role') || '') as StaffRole }, locals.adminUser?.email || 'unknown');
    return redirect('created');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'create_failed';
    return redirect(code);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
