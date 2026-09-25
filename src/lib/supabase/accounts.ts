import { getSupabaseAdmin } from './server';

type Row = Record<string, unknown>;
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Supabase query failed.'); };

export type CustomerBookingStatusEvent = { fromStatus: string | null; status: string; occurredAt: string };
export type CustomerBooking = { id: string; practitionerName: string; practitionerSlug: string; startsAt: string; endsAt: string; status: string; origin: string; statusHistory: CustomerBookingStatusEvent[] };
export type CustomerBookingNotification = { id: string; bookingId: string; createdAt: string; readAt: string | null; status: string; practitionerName: string; startsAt: string };
export type CustomerTransaction = { id: string; createdAt: string; status: string; totalCents: number; currency: string; provider: string | null; productSlug: string | null };
export type CustomerEntitlement = { id: string; productTitle: string; productSlug: string; productType: string; status: string; grantedAt: string };
export type NotificationPreferences = { bookingEmailEnabled: boolean; bookingReminderEnabled: boolean; weeklyDigestEnabled: boolean; timezone: string };
export type SecurityActivity = { occurredAt: string; action: string; metadata: Record<string, unknown> };

export const listCustomerBookings = async (userId: string): Promise<CustomerBooking[]> => {
  const { data, error } = await getSupabaseAdmin().from('bookings').select('id,starts_at,ends_at,status,origin,practitioners(name,slug)').eq('customer_user_id', userId).order('starts_at', { ascending: false });
  fail(error);
  const rows = (data || []) as Row[];
  if (!rows.length) return [];
  const bookingIds = rows.map((row) => String(row.id));
  const { data: eventRows, error: eventError } = await getSupabaseAdmin()
    .from('booking_status_events')
    .select('booking_id,from_status,to_status,occurred_at')
    .in('booking_id', bookingIds)
    .eq('customer_visible', true)
    .order('occurred_at', { ascending: true })
    .order('id', { ascending: true });
  fail(eventError);
  const history = new Map<string, CustomerBookingStatusEvent[]>();
  ((eventRows || []) as Row[]).forEach((event) => {
    const bookingId = String(event.booking_id);
    history.set(bookingId, [...(history.get(bookingId) || []), {
      fromStatus: event.from_status ? String(event.from_status) : null,
      status: String(event.to_status),
      occurredAt: String(event.occurred_at),
    }]);
  });
  return rows.map((row) => {
    const practitioner = (Array.isArray(row.practitioners) ? row.practitioners[0] : row.practitioners || {}) as Row;
    return { id: String(row.id), practitionerName: String(practitioner.name || 'Professional'), practitionerSlug: String(practitioner.slug || ''), startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status), origin: String(row.origin || 'customer_request'), statusHistory: history.get(String(row.id)) || [] };
  });
};
export const countUnreadCustomerBookingNotifications = async (userId: string): Promise<number> => {
  const { count, error } = await getSupabaseAdmin()
    .from('customer_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_user_id', userId)
    .is('read_at', null);
  fail(error);
  return count || 0;
};
export const listCustomerBookingNotifications = async (userId: string): Promise<CustomerBookingNotification[]> => {
  const client = getSupabaseAdmin();
  const { data: notificationRows, error } = await client
    .from('customer_notifications')
    .select('id,booking_id,status_event_id,schedule_event_id,created_at,read_at')
    .eq('customer_user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  fail(error);
  const notifications = (notificationRows || []) as Row[];
  if (!notifications.length) return [];

  const eventIds = notifications.filter((row) => row.status_event_id != null).map((row) => Number(row.status_event_id));
  const scheduleIds = notifications.filter((row) => row.schedule_event_id != null).map((row) => Number(row.schedule_event_id));
  const bookingIds = [...new Set(notifications.map((row) => String(row.booking_id)))];
  const [{ data: eventRows, error: eventError }, { data: bookingRows, error: bookingError }, { data: scheduleRows, error: scheduleError }] = await Promise.all([
    eventIds.length ? client.from('booking_status_events').select('id,to_status,from_status').in('id', eventIds).eq('customer_visible', true) : Promise.resolve({ data: [], error: null }),
    client.from('bookings').select('id,starts_at,origin,practitioners(name)').in('id', bookingIds).eq('customer_user_id', userId),
    scheduleIds.length ? client.from('booking_schedule_events').select('id,new_starts_at').in('id', scheduleIds) : Promise.resolve({ data: [], error: null }),
  ]);
  fail(eventError);
  fail(bookingError);
  fail(scheduleError);

  const events = new Map(((eventRows || []) as Row[]).map((row) => [String(row.id), { status: String(row.to_status), initial: row.from_status == null }]));
  const scheduleTimes = new Map(((scheduleRows || []) as Row[]).map((row) => [String(row.id), String(row.new_starts_at)]));
  const bookings = new Map(((bookingRows || []) as Row[]).map((row) => {
    const practitioner = (Array.isArray(row.practitioners) ? row.practitioners[0] : row.practitioners || {}) as Row;
    return [String(row.id), { startsAt: String(row.starts_at), practitionerName: String(practitioner.name || 'Je professional'), origin: String(row.origin || 'customer_request') }];
  }));
  return notifications.flatMap((row) => {
    const booking = bookings.get(String(row.booking_id));
    const event = events.get(String(row.status_event_id));
    const status = row.schedule_event_id != null ? 'rescheduled' : event?.initial && booking?.origin === 'staff' ? 'scheduled' : event?.status;
    if (!booking || !status) return [];
    return [{
      id: String(row.id),
      bookingId: String(row.booking_id),
      createdAt: String(row.created_at),
      readAt: row.read_at ? String(row.read_at) : null,
      status,
      practitionerName: booking.practitionerName,
      startsAt: row.schedule_event_id != null ? scheduleTimes.get(String(row.schedule_event_id)) || booking.startsAt : booking.startsAt,
    }];
  });
};
export const markCustomerBookingNotificationRead = async (notificationId: string, userId: string): Promise<string> => {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from('customer_notifications')
    .select('booking_id')
    .eq('id', notificationId)
    .eq('customer_user_id', userId)
    .maybeSingle();
  fail(error);
  if (!data?.booking_id) throw new Error('not_found');
  const { error: updateError } = await client
    .from('customer_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('customer_user_id', userId)
    .is('read_at', null);
  fail(updateError);
  return String(data.booking_id);
};
export const listCustomerTransactions = async (userId: string): Promise<CustomerTransaction[]> => {
  const { data, error } = await getSupabaseAdmin().from('orders').select('id,created_at,status,total_cents,currency,provider,order_items(product_slug)').eq('customer_user_id', userId).order('created_at', { ascending: false });
  fail(error);
  return ((data || []) as Row[]).map((row) => { const item = (Array.isArray(row.order_items) ? row.order_items[0] : row.order_items) as Row | null; return { id: String(row.id), createdAt: String(row.created_at), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency), provider: row.provider ? String(row.provider) : null, productSlug: item?.product_slug ? String(item.product_slug) : null }; });
};
export const listCustomerEntitlements = async (userId: string): Promise<CustomerEntitlement[]> => {
  const { data, error } = await getSupabaseAdmin().from('entitlements').select('id,product_title,product_slug,product_type,status,granted_at').eq('customer_user_id', userId).order('granted_at', { ascending: false });
  fail(error);
  return ((data || []) as Row[]).map((row) => ({ id: String(row.id), productTitle: String(row.product_title), productSlug: String(row.product_slug), productType: String(row.product_type), status: String(row.status), grantedAt: String(row.granted_at) }));
};
export const cancelCustomerBooking = async (bookingId: string, customerId: string, requestId?: string, requestPath?: string) => {
  const { error } = await getSupabaseAdmin().rpc('cancel_customer_booking', {
    p_booking_id: bookingId,
    p_customer_id: customerId,
    p_request_id: requestId || null,
    p_request_path: requestPath || null,
  });
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
