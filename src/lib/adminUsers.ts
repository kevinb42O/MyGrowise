import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

/** The only human-manageable organisation roles. Practitioner/customer are scoped capabilities. */
export const STAFF_ROLES = ['super_admin', 'support', 'employee'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  suspendedUntil: string | null;
};

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const activeSuspension = (value: string | null | undefined) => Boolean(value && new Date(value).getTime() > Date.now());
const requireValidStaffRole = (role: string): role is StaffRole => STAFF_ROLES.includes(role as StaffRole);

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
    id: user.id,
    email: user.email || 'E-mail ontbreekt',
    fullName: String(user.user_metadata?.full_name || ''),
    roles: roles.get(user.id) || [],
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    confirmed: Boolean(user.email_confirmed_at),
    suspendedUntil: user.banned_until || null,
  })).sort((a, b) => a.email.localeCompare(b.email));
};

export const createStaffUser = async (input: { email: string; fullName: string; temporaryPassword: string; role: StaffRole }, actor: AuditActor) => {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (!validEmail(email) || fullName.length < 2 || fullName.length > 120 || input.temporaryPassword.length < 12 || input.temporaryPassword.length > 256 || !requireValidStaffRole(input.role)) throw new Error('invalid_input');
  const client = getSupabaseAdmin();
  const { data, error } = await client.auth.admin.createUser({ email, password: input.temporaryPassword, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes('already')) throw new Error('email_taken');
    throw new Error('create_failed');
  }
  await client.from('user_roles').delete().eq('user_id', data.user.id).eq('role', 'customer');
  const { error: roleError } = await client.from('user_roles').upsert({ user_id: data.user.id, role: input.role });
  if (roleError) throw new Error('role_failed');
  await writeSecurityAudit({ actor, action: 'staff.user_created', objectType: 'user', objectId: data.user.id, after: { email, full_name: fullName, role: input.role } });
  return data.user.id;
};

export const changeStaffRole = async (input: { userId: string; role: StaffRole; actorId: string }, actor: AuditActor) => {
  if (!uuid(input.userId) || !requireValidStaffRole(input.role)) throw new Error('invalid_input');
  if (input.userId === input.actorId) throw new Error('self_change_forbidden');
  const client = getSupabaseAdmin();
  const { data: existingRows, error } = await client.from('user_roles').select('role').eq('user_id', input.userId);
  if (error || !existingRows?.length) throw new Error('not_found');
  const existingRoles = existingRows.map((row) => String(row.role));
  const oldStaffRole = existingRoles.find((role): role is StaffRole => requireValidStaffRole(role));
  if (oldStaffRole === input.role) return;
  if (oldStaffRole === 'super_admin' && input.role !== 'super_admin') {
    const { count, error: countError } = await client.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin');
    if (countError) throw new Error('role_failed');
    if ((count || 0) < 2) throw new Error('last_owner_protected');
  }
  if (oldStaffRole) {
    const { error: deleteError } = await client.from('user_roles').delete().eq('user_id', input.userId).eq('role', oldStaffRole);
    if (deleteError) throw new Error('role_failed');
  }
  const { error: insertError } = await client.from('user_roles').upsert({ user_id: input.userId, role: input.role });
  if (insertError) throw new Error('role_failed');
  await writeSecurityAudit({ actor, action: 'staff.role_changed', objectType: 'user', objectId: input.userId, before: { role: oldStaffRole || null }, after: { role: input.role } });
};

export const setStaffAccess = async (input: { userId: string; suspended: boolean; actorId: string }, actor: AuditActor) => {
  if (!uuid(input.userId)) throw new Error('invalid_input');
  if (input.userId === input.actorId) throw new Error('self_change_forbidden');
  const client = getSupabaseAdmin();
  const [{ data: roleRows, error: roleError }, { data: target, error: targetError }] = await Promise.all([
    client.from('user_roles').select('role').eq('user_id', input.userId), client.auth.admin.getUserById(input.userId),
  ]);
  if (roleError || targetError || !target.user) throw new Error('not_found');
  const targetRoles = (roleRows || []).map((row) => String(row.role));
  if (!targetRoles.some((role) => requireValidStaffRole(role))) throw new Error('not_staff');
  if (input.suspended && targetRoles.includes('super_admin')) {
    const { count, error: countError } = await client.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin');
    if (countError) throw new Error('access_failed');
    if ((count || 0) < 2) throw new Error('last_owner_protected');
  }
  const { error: updateError } = await client.auth.admin.updateUserById(input.userId, { ban_duration: input.suspended ? '876000h' : 'none' });
  if (updateError) throw new Error('access_failed');
  await writeSecurityAudit({ actor, action: input.suspended ? 'staff.user_suspended' : 'staff.user_reactivated', objectType: 'user', objectId: input.userId, before: { suspended: activeSuspension(target.user.banned_until) }, after: { suspended: input.suspended } });
};
