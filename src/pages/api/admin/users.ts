import type { APIRoute } from 'astro';
import { changeStaffRole, createStaffUser, setStaffAccess, type StaffRole } from '../../../lib/adminUsers';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { auditActor } from '../../../lib/securityAudit';

export const prerender = false;
const redirect = (message: string) => new Response(null, { status: 303, headers: { location: `/admin/gebruikers?message=${encodeURIComponent(message)}` } });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  try {
    const actor = auditActor(locals.adminUser, locals.requestId, '/api/admin/users');
    const operation = String(form.get('operation') || 'create');
    if (operation === 'create') {
      await createStaffUser({ email: String(form.get('email') || ''), fullName: String(form.get('full_name') || ''), temporaryPassword: String(form.get('temporary_password') || ''), role: String(form.get('role') || '') as StaffRole }, actor);
      return redirect('created');
    }
    if (operation === 'change_role') {
      await changeStaffRole({ userId: String(form.get('user_id') || ''), role: String(form.get('role') || '') as StaffRole, actorId: locals.adminUser?.sub || '' }, actor);
      return redirect('role_changed');
    }
    if (operation === 'set_access') {
      await setStaffAccess({ userId: String(form.get('user_id') || ''), suspended: String(form.get('suspended') || '') === 'true', actorId: locals.adminUser?.sub || '' }, actor);
      return redirect(String(form.get('suspended') || '') === 'true' ? 'suspended' : 'reactivated');
    }
    return redirect('invalid_input');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'create_failed';
    return redirect(code);
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
