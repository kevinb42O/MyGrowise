import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type RecordRow = Record<string, any>;
export type AdminOrder = { id: string; status: string; totalCents: number; currency: string; createdAt: string; customerId: string };
export type AdminBooking = { id: string; practitionerId: string; practitionerName: string; clientName: string; clientEmail: string; startsAt: string; endsAt: string; status: string; createdAt: string };
export type AdminTask = { id: string; title: string; category: string; priority: number; status: string; dueAt: string | null; createdAt: string };
export type IntegrationCheck = { key: string; label: string; state: 'healthy' | 'degraded' | 'not_configured' | 'failed'; detail: string | null; lastCheckedAt: string | null };

const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Supabase query failed.'); };
const money = (cents: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);

export const listAdminOrders = async (limit = 100): Promise<AdminOrder[]> => {
  const { data, error } = await getSupabaseAdmin().from('orders').select('id,status,total_cents,currency,created_at,customer_user_id').order('created_at', { ascending: false }).limit(limit);
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ id: String(row.id), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency), createdAt: String(row.created_at), customerId: String(row.customer_user_id) }));
};

export const listAdminBookings = async (limit = 100): Promise<AdminBooking[]> => {
  const { data, error } = await getSupabaseAdmin().from('bookings').select('id,practitioner_id,client_name,client_email,starts_at,ends_at,status,created_at,practitioners(name)').order('starts_at', { ascending: true }).limit(limit);
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ id: String(row.id), practitionerId: String(row.practitioner_id), practitionerName: String(row.practitioners?.name || 'Onbekend'), clientName: String(row.client_name), clientEmail: String(row.client_email), startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status), createdAt: String(row.created_at) }));
};

const bookingTransitions: Record<string, string[]> = {
  pending: ['confirmed', 'declined', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  declined: [], cancelled: [], completed: [], no_show: [],
};

export const updateAdminBookingStatus = async (id: string, nextStatus: string, actor: AuditActor) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !Object.hasOwn(bookingTransitions, nextStatus)) throw new Error('invalid_input');
  const client = getSupabaseAdmin();
  const { data: before, error: beforeError } = await client.from('bookings').select('id,status,practitioner_id,starts_at,ends_at').eq('id', id).maybeSingle();
  fail(beforeError); if (!before) throw new Error('not_found');
  if (!bookingTransitions[String(before.status)]?.includes(nextStatus)) throw new Error('invalid_transition');
  const { data, error } = await client.from('bookings').update({ status: nextStatus, calendar_booked_at: nextStatus === 'confirmed' ? new Date().toISOString() : null }).eq('id', id).select('id,status').single();
  fail(error);
  if (!data) throw new Error('database_error');
  await writeSecurityAudit({ actor, action: 'booking.status_updated_by_admin', objectType: 'booking', objectId: id, before: { status: before.status, practitioner_id: before.practitioner_id, starts_at: before.starts_at, ends_at: before.ends_at }, after: { status: data.status } });
  return String(data.status);
};

export const listAdminTasks = async (limit = 12): Promise<AdminTask[]> => {
  const { data, error } = await getSupabaseAdmin().from('admin_work_items').select('id,title,category,priority,status,due_at,created_at').in('status', ['open', 'in_progress', 'blocked']).order('priority', { ascending: true }).order('due_at', { ascending: true, nullsFirst: false }).limit(limit);
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ id: String(row.id), title: String(row.title), category: String(row.category), priority: Number(row.priority), status: String(row.status), dueAt: row.due_at ? String(row.due_at) : null, createdAt: String(row.created_at) }));
};

export const listIntegrationChecks = async (): Promise<IntegrationCheck[]> => {
  const { data, error } = await getSupabaseAdmin().from('integration_status').select('key,label,state,detail,last_checked_at').order('key');
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ key: String(row.key), label: String(row.label), state: row.state as IntegrationCheck['state'], detail: row.detail ? String(row.detail) : null, lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null }));
};

export const getSuperadminOverview = async () => {
  const [orders, bookings, integrations, tasks, productsResult, auditResult, analyticsResult] = await Promise.all([
    listAdminOrders(500), listAdminBookings(200), listIntegrationChecks(), listAdminTasks(),
    getSupabaseAdmin().from('products').select('id,status', { count: 'exact' }),
    getSupabaseAdmin().from('security_audit_log').select('occurred_at,action,object_type,object_id').order('occurred_at', { ascending: false }).limit(8),
    getSupabaseAdmin().from('analytics_events').select('id,event_name,anonymous_id,occurred_at', { count: 'exact' }).eq('consented', true).gte('occurred_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);
  fail(productsResult.error); fail(auditResult.error); fail(analyticsResult.error);
  const paid = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const netRevenueCents = paid.reduce((total, order) => total + order.totalCents, 0);
  const events = (analyticsResult.data || []) as RecordRow[];
  const sessions = new Set(events.filter((event) => event.event_name === 'page_view').map((event) => event.anonymous_id).filter(Boolean)).size;
  const purchases = events.filter((event) => event.event_name === 'payment_succeeded').length;
  const bookingClicks = events.filter((event) => event.event_name === 'booking_clicked').length;
  return {
    orders, bookings, integrations, tasks, paidOrders: paid.length, netRevenueCents, netRevenue: money(netRevenueCents),
    conversion: sessions ? purchases / sessions : null, bookingClicks, publishedProducts: ((productsResult.data || []) as RecordRow[]).filter((product) => product.status === 'published').length,
    productCount: productsResult.count || 0, analyticsEvents: analyticsResult.count || 0,
    pendingBookings: bookings.filter((booking) => booking.status === 'pending').length,
    activity: ((auditResult.data || []) as RecordRow[]).map((row) => ({ occurredAt: String(row.occurred_at), action: String(row.action), objectType: String(row.object_type), objectId: String(row.object_id) })),
  };
};

export const listAdminCustomers = async () => {
  const [profilesResult, orders] = await Promise.all([
    getSupabaseAdmin().from('profiles').select('id,full_name,created_at').order('created_at', { ascending: false }).limit(200), listAdminOrders(500),
  ]);
  fail(profilesResult.error);
  const totals = new Map<string, { orders: number; spent: number }>();
  orders.forEach((order) => { const current = totals.get(order.customerId) || { orders: 0, spent: 0 }; current.orders += 1; current.spent += order.status === 'paid' || order.status === 'fulfilled' ? order.totalCents : 0; totals.set(order.customerId, current); });
  return ((profilesResult.data || []) as RecordRow[]).map((profile) => ({ id: String(profile.id), name: String(profile.full_name || 'Naam niet ingevuld'), createdAt: String(profile.created_at), orderCount: totals.get(String(profile.id))?.orders || 0, totalCents: totals.get(String(profile.id))?.spent || 0 }));
};

export const getAdminCustomer = async (id: string) => {
  const client = getSupabaseAdmin();
  const [{ data: profile, error: profileError }, { data: authData, error: authError }, ordersResult, entitlementsResult, bookingsResult, requestsResult] = await Promise.all([
    client.from('profiles').select('id,full_name,timezone,created_at').eq('id', id).maybeSingle(),
    client.auth.admin.getUserById(id),
    client.from('orders').select('id,status,total_cents,currency,created_at,order_items(product_title,product_slug,product_type,price_cents)').eq('customer_user_id', id).order('created_at', { ascending: false }).limit(100),
    client.from('entitlements').select('id,product_title,product_slug,product_type,status,granted_at,revoked_at').eq('customer_user_id', id).order('granted_at', { ascending: false }).limit(100),
    client.from('bookings').select('id,starts_at,ends_at,status,practitioners(name)').eq('customer_user_id', id).order('starts_at', { ascending: false }).limit(100),
    client.from('data_subject_requests').select('id,request_type,status,received_at,due_at,resolved_at').eq('customer_user_id', id).order('received_at', { ascending: false }).limit(50),
  ]);
  fail(profileError); fail(ordersResult.error); fail(entitlementsResult.error); fail(bookingsResult.error); fail(requestsResult.error);
  if (!profile || authError || !authData.user) return null;
  return {
    id: String(profile.id), name: String(profile.full_name || 'Naam niet ingevuld'), email: authData.user.email || 'E-mail ontbreekt', timezone: String(profile.timezone), createdAt: String(profile.created_at),
    orders: ((ordersResult.data || []) as RecordRow[]).map((item) => ({ id: String(item.id), status: String(item.status), totalCents: Number(item.total_cents), currency: String(item.currency), createdAt: String(item.created_at), items: Array.isArray(item.order_items) ? item.order_items.map((line: RecordRow) => ({ title: String(line.product_title), slug: String(line.product_slug), type: String(line.product_type), priceCents: Number(line.price_cents) })) : [] })),
    entitlements: ((entitlementsResult.data || []) as RecordRow[]).map((item) => ({ id: String(item.id), title: String(item.product_title), slug: String(item.product_slug), type: String(item.product_type), status: String(item.status), grantedAt: String(item.granted_at), revokedAt: item.revoked_at ? String(item.revoked_at) : null })),
    bookings: ((bookingsResult.data || []) as RecordRow[]).map((item) => ({ id: String(item.id), startsAt: String(item.starts_at), endsAt: String(item.ends_at), status: String(item.status), practitionerName: String(item.practitioners?.name || 'Onbekend') })),
    privacyRequests: ((requestsResult.data || []) as RecordRow[]).map((item) => ({ id: String(item.id), type: String(item.request_type), status: String(item.status), receivedAt: String(item.received_at), dueAt: String(item.due_at), resolvedAt: item.resolved_at ? String(item.resolved_at) : null })),
  };
};

export const listAdminPractitioners = async () => {
  const { data, error } = await getSupabaseAdmin().from('practitioners').select('id,slug,name,active,updated_at,practitioner_settings(appointment_duration_minutes,minimum_notice_hours,booking_horizon_days,requests_enabled),availability_rules(id),bookings(id,status)').order('name');
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({
    id: String(row.id), slug: String(row.slug), name: String(row.name), active: Boolean(row.active), updatedAt: String(row.updated_at),
    settings: Array.isArray(row.practitioner_settings) ? row.practitioner_settings[0] : row.practitioner_settings,
    availabilityRules: Array.isArray(row.availability_rules) ? row.availability_rules.length : 0,
    pendingBookings: Array.isArray(row.bookings) ? row.bookings.filter((booking: RecordRow) => booking.status === 'pending').length : 0,
  }));
};

export const listDataSubjectRequests = async () => {
  const { data, error } = await getSupabaseAdmin().from('data_subject_requests').select('id,request_type,status,received_at,due_at,resolved_at,customer_user_id').order('due_at').limit(100);
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ id: String(row.id), type: String(row.request_type), status: String(row.status), receivedAt: String(row.received_at), dueAt: String(row.due_at), resolvedAt: row.resolved_at ? String(row.resolved_at) : null, customerId: row.customer_user_id ? String(row.customer_user_id) : null }));
};
