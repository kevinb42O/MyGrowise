import {readAdminPage, readAllAdminRows} from './adminPagination';
import { getSupabaseAdmin } from './supabase/server';
import { hasPermission, type UserSession } from './adminAuth';
import type { AuditActor } from './securityAudit';

type RecordRow = Record<string, any>;
export type AdminOrder = { id: string; status: string; totalCents: number; currency: string; createdAt: string; customerId: string; paymentVerifiedAt?: string | null; paymentClaimedAt?: string | null; provider?: string };
export type AdminOrderDetail = { id: string; status: string; totalCents: number; currency: string; createdAt: string; customerId: string; customerName: string; provider: string; reference: string; paymentClaimedAt: string | null; paymentVerifiedAt: string | null; productTitles: string[] };
export type AdminBooking = { cancellationCategory?: string; noShowBilling?: string; appointmentName?:string; id: string; practitionerId: string; practitionerName: string; patientId: string | null; clientName: string; clientEmail: string; startsAt: string; endsAt: string; status: string; createdAt: string };
export type AdminTask = { id: string; title: string; category: string; priority: number; status: string; dueAt: string | null; createdAt: string; assignedToName: string | null };
export type IntegrationCheck = { key: string; label: string; state: 'healthy' | 'degraded' | 'not_configured' | 'failed'; detail: string | null; lastCheckedAt: string | null };

const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Supabase query failed.'); };

export const listAdminOrders = async (limit = 100): Promise<AdminOrder[]> => {
  const { data, error } = await getSupabaseAdmin().from('orders').select('id,status,total_cents,currency,created_at,customer_user_id').order('created_at', { ascending: false }).limit(limit);
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ id: String(row.id), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency), createdAt: String(row.created_at), customerId: String(row.customer_user_id) }));
};

const listDashboardOrders = async (): Promise<AdminOrder[]> => {
  const client = getSupabaseAdmin();
  const orders: AdminOrder[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('orders')
      .select('id,status,total_cents,currency,created_at,customer_user_id,payment_verified_at,payment_claimed_at,provider')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499);
    fail(error);
    const page = (data || []) as RecordRow[];
    orders.push(...page.map((row) => ({
      id: String(row.id), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency),
      createdAt: String(row.created_at), customerId: String(row.customer_user_id),
      paymentVerifiedAt: row.payment_verified_at ? String(row.payment_verified_at) : null,
      paymentClaimedAt: row.payment_claimed_at ? String(row.payment_claimed_at) : null,
      provider: String(row.provider || ''),
    })));
    if (page.length < 500) break;
  }
  return orders;
};

export const listAdminOrderDetails = async (): Promise<AdminOrderDetail[]> => {
  const client = getSupabaseAdmin();
  const rows: RecordRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('orders')
      .select('id,status,total_cents,currency,created_at,customer_user_id,provider,provider_reference,payment_claimed_at,payment_verified_at,commerce_buyers!orders_buyer_id_fkey(email,first_name,last_name),profiles!orders_customer_user_id_fkey(full_name),order_items(product_title)')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499);
    fail(error);
    const page = (data || []) as RecordRow[];
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const buyer = Array.isArray(row.commerce_buyers) ? row.commerce_buyers[0] : row.commerce_buyers;
    const items = Array.isArray(row.order_items) ? row.order_items : row.order_items ? [row.order_items] : [];
    return {
      id: String(row.id), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency),
      createdAt: String(row.created_at), customerId: String(row.customer_user_id||''), customerName: String(profile?.full_name || buyer?.email || [buyer?.first_name,buyer?.last_name].filter(Boolean).join(' ') || 'Gast'),
      provider: String(row.provider || ''),
      reference: String(row.provider_reference || ''), paymentClaimedAt: row.payment_claimed_at ? String(row.payment_claimed_at) : null,
      paymentVerifiedAt: row.payment_verified_at ? String(row.payment_verified_at) : null,
      productTitles: items.map((item: RecordRow) => String(item.product_title || 'Product')),
    };
  });
};

export const listAdminBookings = async (limit = 100, offset = 0, status?: string): Promise<AdminBooking[]> => {
  const query = getSupabaseAdmin().from('bookings').select('id,practitioner_id,patient_id,client_name,client_email,appointment_name,starts_at,ends_at,status,cancellation_category,no_show_billing,created_at,practitioners(name)').order('starts_at', { ascending: false }).order('id').range(offset,offset+limit-1);
  if(status) query.eq('status',status);
  const {data,error}=await query;
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ id: String(row.id), practitionerId: String(row.practitioner_id), practitionerName: String(row.practitioners?.name || 'Onbekend'), patientId: row.patient_id ? String(row.patient_id) : null, appointmentName:String(row.appointment_name||'Afspraaktype nog te bepalen'), clientName: String(row.client_name), clientEmail: String(row.client_email), startsAt: String(row.starts_at), endsAt: String(row.ends_at), cancellationCategory: String(row.cancellation_category || 'unknown'), noShowBilling: String(row.no_show_billing || 'unreviewed'), status: String(row.status), createdAt: String(row.created_at) }));
};

const listDashboardBookings = async (): Promise<AdminBooking[]> => {
  const client = getSupabaseAdmin();
  const bookings: AdminBooking[] = [];
  const after = new Date().toISOString();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('bookings')
      .select('id,practitioner_id,patient_id,client_name,client_email,appointment_name,starts_at,ends_at,status,cancellation_category,no_show_billing,created_at,practitioners(name)')
      .in('status', ['pending', 'confirmed']).or(`status.eq.pending,starts_at.gte.${after}`)
      .order('starts_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 499);
    fail(error);
    const page = (data || []) as RecordRow[];
    bookings.push(...page.map((row) => ({
      id: String(row.id), practitionerId: String(row.practitioner_id), practitionerName: String(row.practitioners?.name || 'Onbekend'),
      patientId: row.patient_id ? String(row.patient_id) : null, appointmentName:String(row.appointment_name||'Afspraaktype nog te bepalen'), clientName: String(row.client_name), clientEmail: String(row.client_email),
      startsAt: String(row.starts_at), endsAt: String(row.ends_at), cancellationCategory: String(row.cancellation_category || 'unknown'), noShowBilling: String(row.no_show_billing || 'unreviewed'), status: String(row.status), createdAt: String(row.created_at),
    })));
    if (page.length < 500) break;
  }
  return bookings;
};

const bookingTransitions: Record<string, string[]> = {
  pending: ['confirmed', 'declined', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  declined: [], cancelled: [], completed: [], no_show: [],
};

export const updateAdminBookingStatus = async (id: string, nextStatus: string, actor: AuditActor) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !Object.hasOwn(bookingTransitions, nextStatus)) throw new Error('invalid_input');
  const { data, error } = await getSupabaseAdmin().rpc('transition_booking_status', {
    p_booking_id: id,
    p_actor_user_id: actor.userId,
    p_next_status: nextStatus,
    p_request_id: actor.requestId || null,
    p_request_path: actor.requestPath || null,
  });
  if (error?.code === 'P0002') throw new Error('not_found');
  if (error?.code === '42501') throw new Error('not_allowed');
  if (error?.code === '22023') throw new Error('invalid_transition');
  fail(error);
  return String(data);
};

export const listAdminTasks = async (limit = 12, offset = 0): Promise<AdminTask[]> => {
  const client = getSupabaseAdmin();
  const { data, error } = await client.from('admin_work_items').select('id,title,category,priority,status,due_at,created_at,assigned_to').in('status', ['open', 'in_progress', 'blocked']).order('priority', { ascending: true }).order('due_at', { ascending: true, nullsFirst: false }).order('id').range(offset, offset + limit - 1);
  fail(error);
  const rows = (data || []) as RecordRow[];
  const assignedIds = [...new Set(rows.map((row) => row.assigned_to ? String(row.assigned_to) : '').filter(Boolean))];
  const assigneeNames = new Map<string, string>();
  if (assignedIds.length) {
    const { data: profiles, error: profilesError } = await client.from('profiles').select('id,full_name').in('id', assignedIds);
    fail(profilesError);
    ((profiles || []) as RecordRow[]).forEach((profile) => assigneeNames.set(String(profile.id), String(profile.full_name || 'Naam niet ingevuld')));
  }
  return rows.map((row) => ({ id: String(row.id), title: String(row.title), category: String(row.category), priority: Number(row.priority), status: String(row.status), dueAt: row.due_at ? String(row.due_at) : null, createdAt: String(row.created_at), assignedToName: row.assigned_to ? assigneeNames.get(String(row.assigned_to)) || null : null }));
};

export const listIntegrationChecks = async (): Promise<IntegrationCheck[]> => {
  const { data, error } = await getSupabaseAdmin().from('integration_status').select('key,label,state,detail,last_checked_at').order('key');
  fail(error);
  return ((data || []) as RecordRow[]).map((row) => ({ key: String(row.key), label: String(row.label), state: row.state as IntegrationCheck['state'], detail: row.detail ? String(row.detail) : null, lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null }));
};

export const getSuperadminOverview = async (user: UserSession) => {
  if (!hasPermission(user, 'dashboard.read')) throw new Error('forbidden');
  const emptyCount = { count: 0, error: null };
  const [orders, bookings, tasks, productsResult, analyticsResult, taskCountResult] = await Promise.all([
    hasPermission(user, 'orders.read') ? listDashboardOrders() : Promise.resolve([]),
    hasPermission(user, 'bookings.read') ? listDashboardBookings() : Promise.resolve([]),
    hasPermission(user, 'operations.manage') ? listAdminTasks() : Promise.resolve([]),
    hasPermission(user, 'products.read') ? getSupabaseAdmin().from('products').select('id', { count: 'exact', head: true }).eq('status', 'published') : Promise.resolve(emptyCount),
    hasPermission(user, 'analytics.read') ? getSupabaseAdmin().from('analytics_events').select('id', { count: 'exact', head: true }).eq('consented', true).eq('environment', 'production').eq('event_name', 'page_view').not('path', 'like', '/account%').not('path', 'like', '/admin%').not('path', 'like', '/praktijk%').not('path', 'like', '/api%').gte('occurred_at', new Date(Date.now() - 30 * 86400000).toISOString()) : Promise.resolve(emptyCount),
    hasPermission(user, 'operations.manage') ? getSupabaseAdmin().from('admin_work_items').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'blocked']) : Promise.resolve(emptyCount),
  ]);
  fail(productsResult.error); fail(analyticsResult.error); fail(taskCountResult.error);
  return {
    orders, bookings, tasks,
    publishedProducts: productsResult.count || 0,
    analyticsEvents: analyticsResult.count || 0, openTaskCount: taskCountResult.count || 0,
  };
};

export const listAdminCustomers = async (requestedPage: unknown = 1, search = '') => {
  const client = getSupabaseAdmin();
  // Filter before paging; never derive lifetime spend from a global recent-order window.
  const result = await readAdminPage<RecordRow>((start, end) => {
    const query = client.from('admin_customer_profiles').select('id,full_name,created_at', {count: 'exact'}).order('created_at', {ascending: false}).order('id');
    if (search) query.ilike('full_name', `%${search.replace(/[%_\\]/g, '')}%`);
    return query.range(start, end);
  }, requestedPage);
  const ids = result.items.map(profile => String(profile.id));
  const orders = ids.length ? await readAllAdminRows<RecordRow>((start, end) => client.from('orders').select('id,customer_user_id,status,total_cents').in('customer_user_id', ids).order('id').range(start, end)) : [];
  const totals = new Map<string, {orders: number; spent: number}>();
  orders.forEach(order => {
    const total = totals.get(order.customer_user_id) || {orders: 0, spent: 0};
    total.orders++;
    if (['paid', 'fulfilled'].includes(order.status)) total.spent += Number(order.total_cents);
    totals.set(order.customer_user_id, total);
  });
  const users = await Promise.all(ids.map(async id => {
    const {data, error} = await client.auth.admin.getUserById(id);
    if (error) throw new Error('users_unavailable');
    return [id, data.user?.email || 'E-mail ontbreekt'] as const;
  }));
  const emails = new Map(users);
  return {...result, items: result.items.map(profile => ({id: String(profile.id), name: String(profile.full_name || 'Naam niet ingevuld'), email: emails.get(String(profile.id)) || 'E-mail ontbreekt', createdAt: String(profile.created_at), orderCount: totals.get(String(profile.id))?.orders || 0, totalCents: totals.get(String(profile.id))?.spent || 0}))};
};

export const getAdminCustomer = async (id: string, pages: Record<string, unknown> = {}) => {
  const client = getSupabaseAdmin();
  const { data: customerProfile, error: customerError } = await client.from('admin_customer_profiles').select('id').eq('id', id).maybeSingle();
  fail(customerError);
  if (!customerProfile) return null;
  const [{ data: profile, error: profileError }, { data: authData, error: authError }, ordersResult, entitlementsResult, bookingsResult, requestsResult] = await Promise.all([
    client.from('profiles').select('id,full_name,timezone,created_at').eq('id', id).maybeSingle(),
    client.auth.admin.getUserById(id),
    readAdminPage<RecordRow>((start,end) => client.from('orders').select('id,status,total_cents,currency,created_at,order_items(product_title,product_slug,product_type,price_cents)', {count:'exact'}).eq('customer_user_id', id).order('created_at', {ascending:false}).order('id').range(start,end), pages.orders),
    readAdminPage<RecordRow>((start,end) => client.from('entitlements').select('id,product_title,product_slug,product_type,status,granted_at,revoked_at', {count:'exact'}).eq('customer_user_id', id).order('granted_at', {ascending:false}).order('id').range(start,end), pages.entitlements),
    readAdminPage<RecordRow>((start,end) => client.from('bookings').select('id,starts_at,ends_at,status,cancellation_category,no_show_billing,practitioners(name)', {count:'exact'}).eq('customer_user_id', id).order('starts_at', {ascending:false}).order('id').range(start,end), pages.bookings),
    readAdminPage<RecordRow>((start,end) => client.from('data_subject_requests').select('id,request_type,status,received_at,due_at,resolved_at', {count:'exact'}).eq('customer_user_id', id).order('received_at', {ascending:false}).order('id').range(start,end), pages.privacy),
  ]);
  fail(profileError);
  if (!profile || authError || !authData.user) return null;
  return {
    id: String(profile.id), name: String(profile.full_name || 'Naam niet ingevuld'), email: authData.user.email || 'E-mail ontbreekt', timezone: String(profile.timezone), createdAt: String(profile.created_at),
    pagination: {orders: ordersResult, entitlements: entitlementsResult, bookings: bookingsResult, privacy: requestsResult},
    orders: ((ordersResult.items || []) as RecordRow[]).map((item) => ({ id: String(item.id), status: String(item.status), totalCents: Number(item.total_cents), currency: String(item.currency), createdAt: String(item.created_at), items: Array.isArray(item.order_items) ? item.order_items.map((line: RecordRow) => ({ title: String(line.product_title), slug: String(line.product_slug), type: String(line.product_type), priceCents: Number(line.price_cents) })) : [] })),
    entitlements: ((entitlementsResult.items || []) as RecordRow[]).map((item) => ({ id: String(item.id), title: String(item.product_title), slug: String(item.product_slug), type: String(item.product_type), status: String(item.status), grantedAt: String(item.granted_at), revokedAt: item.revoked_at ? String(item.revoked_at) : null })),
    bookings: ((bookingsResult.items || []) as RecordRow[]).map((item) => ({ id: String(item.id), startsAt: String(item.starts_at), endsAt: String(item.ends_at), status: String(item.status), practitionerName: String(item.practitioners?.name || 'Onbekend') })),
    privacyRequests: ((requestsResult.items || []) as RecordRow[]).map((item) => ({ id: String(item.id), type: String(item.request_type), status: String(item.status), receivedAt: String(item.received_at), dueAt: String(item.due_at), resolvedAt: item.resolved_at ? String(item.resolved_at) : null })),
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

export const listDataSubjectRequests = async (requestedPage: unknown = 1, view = 'open') => {
  const db = getSupabaseAdmin();
  const result = await readAdminPage<RecordRow>((start, end) => {
    const query = db.from('data_subject_requests').select('id,request_type,status,received_at,due_at,resolved_at,customer_user_id', {count:'exact'}).order('due_at').order('id');
    if (view === 'open') query.in('status', ['received','in_progress']);
    if (view === 'closed') query.in('status', ['resolved','rejected']);
    return query.range(start,end);
  }, requestedPage);
  const counts = await Promise.all([
    db.from('data_subject_requests').select('id',{count:'exact',head:true}).in('status',['received','in_progress']),
    db.from('data_subject_requests').select('id',{count:'exact',head:true}).in('status',['received','in_progress']).lt('due_at',new Date(Date.now()+7*86400000).toISOString()),
    db.from('data_subject_requests').select('id',{count:'exact',head:true}).eq('status','resolved'),
  ]);
  counts.forEach(result=>fail(result.error));
  return {...result, open:counts[0].count||0, due:counts[1].count||0, resolved:counts[2].count||0, items:result.items.map(row=>({id:String(row.id),type:String(row.request_type),status:String(row.status),receivedAt:String(row.received_at),dueAt:String(row.due_at),resolvedAt:row.resolved_at?String(row.resolved_at):null,customerId:row.customer_user_id?String(row.customer_user_id):null}))};
};

export const listAdminTaskPage = async (requestedPage: unknown = 1) => {
  const db = getSupabaseAdmin();
  const result = await readAdminPage<RecordRow>((start,end)=>db.from('admin_work_items').select('id',{count:'exact'}).in('status',['open','in_progress','blocked']).order('priority').order('due_at',{nullsFirst:false}).order('id').range(start,end),requestedPage);
  const items = await listAdminTasks(result.pageSize,(result.page-1)*result.pageSize);
  return {...result,items};
};
