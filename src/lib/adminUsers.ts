import { getSupabaseAdmin } from './supabase/server';

export const STAFF_ROLES = ['super_admin', 'admin', 'content_editor', 'clinical_reviewer', 'support', 'analyst', 'practitioner'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AdminUser = { id: string; email: string; fullName: string; roles: string[]; createdAt: string; lastSignInAt: string | null; confirmed: boolean };

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

export const listAdminUsers = async (): Promise<AdminUser[]> => {
  const client = getSupabaseAdmin();
  const [{ data: authData, error: authError }, { data: roleRows, error: roleError }] = await Promise.all([
    client.auth.admin.listUsers({ page: 1, perPage: 100 }), client.from('user_roles').select('user_id,role'),
  ]);
  if (authError) throw new Error('users_unavailable');
  if (roleError) throw new Error('roles_unavailable');
  const roles = new Map<string, string[]>();
  ((roleRows || []) as Array<{ user_id: string; role: string }>).forEach((row) => roles.set(row.user_id, [...(roles.get(row.user_id) || []), row.role]));
  return authData.users.map((user) => ({
    id: user.id, email: user.email || 'E-mail ontbreekt', fullName: String(user.user_metadata?.full_name || ''), roles: roles.get(user.id) || [],
    createdAt: user.created_at, lastSignInAt: user.last_sign_in_at || null, confirmed: Boolean(user.email_confirmed_at),
  })).sort((a, b) => a.email.localeCompare(b.email));
};

export const createStaffUser = async (input: { email: string; fullName: string; temporaryPassword: string; role: StaffRole }, actor: string) => {
  const email = input.email.trim().toLowerCase(); const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (!validEmail(email) || fullName.length < 2 || fullName.length > 120 || input.temporaryPassword.length < 12 || input.temporaryPassword.length > 256 || !STAFF_ROLES.includes(input.role)) throw new Error('invalid_input');
  const client = getSupabaseAdmin();
  const { data, error } = await client.auth.admin.createUser({ email, password: input.temporaryPassword, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes('already')) throw new Error('email_taken');
    throw new Error('create_failed');
  }
  await client.from('user_roles').delete().eq('user_id', data.user.id).eq('role', 'customer');
  const { error: roleError } = await client.from('user_roles').upsert({ user_id: data.user.id, role: input.role });
  if (roleError) throw new Error('role_failed');
  await client.from('security_audit_log').insert({ action: 'staff.user_created', object_type: 'user', object_id: data.user.id, metadata: { email, role: input.role, actor } });
  return data.user.id;
};
