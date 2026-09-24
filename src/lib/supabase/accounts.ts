import { getSupabaseAdmin } from './server';

type Row = Record<string, unknown>;
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Supabase query failed.'); };

export type CustomerBooking = { id: string; practitionerName: string; practitionerSlug: string; startsAt: string; endsAt: string; status: string };
export type CustomerTransaction = { id: string; createdAt: string; status: string; totalCents: number; currency: string };
export type CustomerEntitlement = { id: string; productTitle: string; productSlug: string; productType: string; status: string; grantedAt: string };
export type NotificationPreferences = { bookingEmailEnabled: boolean; bookingReminderEnabled: boolean; weeklyDigestEnabled: boolean; timezone: string };
export type SecurityActivity = { occurredAt: string; action: string; metadata: Record<string, unknown> };

export const listCustomerBookings = async (userId: string): Promise<CustomerBooking[]> => {
  const { data, error } = await getSupabaseAdmin().from('bookings').select('id,starts_at,ends_at,status,practitioners(name,slug)').eq('customer_user_id', userId).order('starts_at', { ascending: false });
  fail(error);
  return ((data || []) as Row[]).map((row) => { const practitioner = (Array.isArray(row.practitioners) ? row.practitioners[0] : row.practitioners || {}) as Row; return { id: String(row.id), practitionerName: String(practitioner.name || 'Professional'), practitionerSlug: String(practitioner.slug || ''), startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status) }; });
};
export const listCustomerTransactions = async (userId: string): Promise<CustomerTransaction[]> => {
  const { data, error } = await getSupabaseAdmin().from('orders').select('id,created_at,status,total_cents,currency').eq('customer_user_id', userId).order('created_at', { ascending: false });
  fail(error);
  return ((data || []) as Row[]).map((row) => ({ id: String(row.id), createdAt: String(row.created_at), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency) }));
};
export const listCustomerEntitlements = async (userId: string): Promise<CustomerEntitlement[]> => {
  const { data, error } = await getSupabaseAdmin().from('entitlements').select('id,product_title,product_slug,product_type,status,granted_at').eq('customer_user_id', userId).order('granted_at', { ascending: false });
  fail(error);
  return ((data || []) as Row[]).map((row) => ({ id: String(row.id), productTitle: String(row.product_title), productSlug: String(row.product_slug), productType: String(row.product_type), status: String(row.status), grantedAt: String(row.granted_at) }));
};
export const cancelCustomerBooking = async (bookingId: string, customerId: string) => {
  const { error } = await getSupabaseAdmin().rpc('cancel_customer_booking', { p_booking_id: bookingId, p_customer_id: customerId });
  if (!error) return;
  if (error.code === 'P0001') throw new Error('too_late');
  throw new Error('not_found');
};
export const getNotificationPreferences = async (userId: string): Promise<NotificationPreferences> => {
  const client = getSupabaseAdmin();
  let { data, error } = await client.from('user_preferences').select('booking_email_enabled,booking_reminder_enabled,weekly_digest_enabled,timezone').eq('user_id', userId).maybeSingle();
  fail(error);
  if (!data) {
    const created = await client.from('user_preferences').insert({ user_id: userId }).select('booking_email_enabled,booking_reminder_enabled,weekly_digest_enabled,timezone').single();
    data = created.data; error = created.error; fail(error);
  }
  return { bookingEmailEnabled: Boolean(data?.booking_email_enabled ?? true), bookingReminderEnabled: Boolean(data?.booking_reminder_enabled ?? true), weeklyDigestEnabled: Boolean(data?.weekly_digest_enabled ?? false), timezone: String(data?.timezone || 'Europe/Brussels') };
};
export const updateNotificationPreferences = async (userId: string, input: Omit<NotificationPreferences, 'timezone'>) => {
  const { error } = await getSupabaseAdmin().from('user_preferences').upsert({ user_id: userId, booking_email_enabled: input.bookingEmailEnabled, booking_reminder_enabled: input.bookingReminderEnabled, weekly_digest_enabled: input.weeklyDigestEnabled }, { onConflict: 'user_id' });
  fail(error);
  await getSupabaseAdmin().from('security_audit_log').insert({ actor_user_id: userId, action: 'account.notifications_updated', object_type: 'user', object_id: userId });
};
export const listOwnSecurityActivity = async (userId: string): Promise<SecurityActivity[]> => {
  const { data, error } = await getSupabaseAdmin().from('security_audit_log').select('occurred_at,action,metadata').eq('actor_user_id', userId).like('action', 'account.%').order('occurred_at', { ascending: false }).limit(12);
  fail(error);
  return ((data || []) as Row[]).map((row) => ({ occurredAt: String(row.occurred_at), action: String(row.action), metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown> }));
};
export const updateOwnEmail = async (userId: string, email: string) => {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('invalid_email');
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, { email: normalized });
  if (error) {
    if (error.message.toLowerCase().includes('already')) throw new Error('email_taken');
    throw error;
  }
  await getSupabaseAdmin().from('security_audit_log').insert({ actor_user_id: userId, action: 'account.email_updated', object_type: 'user', object_id: userId });
};
export const updateOwnPassword = async (userId: string, password: string) => {
  if (password.length < 12 || password.length > 256) throw new Error('weak_password');
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, { password });
  if (error) throw error;
  await getSupabaseAdmin().from('security_audit_log').insert({ actor_user_id: userId, action: 'account.password_updated', object_type: 'user', object_id: userId });
};
export const revokeAllUserSessions = async (userId: string) => {
  const { error } = await getSupabaseAdmin().auth.admin.signOut(userId, 'global');
  if (error) throw error;
  await getSupabaseAdmin().from('security_audit_log').insert({ actor_user_id: userId, action: 'account.sessions_revoked', object_type: 'user', object_id: userId });
};
