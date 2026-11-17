import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load = (file, dependencies = {}) => {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: name => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, Request, Response, URL, Date, Intl, Map, Set }, { filename: file });
  return exports;
};
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const permissions = load('../src/lib/adminPermissions.ts');
const auth = { hasPermission: (user, permission) => permissions.hasAdminPermission(user.roles, permission), isTrustedFormOrigin: () => true };
const user = (role, extra = {}) => ({ sub: id, roles: [role], practitionerId: null, ...extra });
const presentation = load('../src/lib/notificationPresentation.ts');
const paging = load('../src/lib/messagePagination.ts');
const workday = load('../src/lib/practiceWorkday.ts');

// A filter-aware storage boundary verifies that service-key reads stay in scope.
function storage(rows = {}, failure = '') {
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [], selection: '', update: null, max: Infinity, start: 0, end: Infinity };
    calls.push(call);
    const query = {
      select(columns, options) { call.selection = columns; call.count = options?.count; return query; },
      update(value) { call.update = value; return query; },
      eq(key, value) { call.filters.push(r => r[key] === value); return query; },
      is(key, value) { call.filters.push(r => (r[key] ?? null) === value); return query; },
      lte(key, value) { call.filters.push(r => r[key] <= value); return query; },
      in(key, values) { call.filters.push(r => values.includes(r[key])); return query; },
      order() { return query; }, or(value) { call.or = value; return query; },
      range(start, end) { call.start = start; call.end = end; return query; },
      limit(max) { call.max = max; return query; },
      then(resolve, reject) {
        const matched = (rows[table] || []).filter(row => call.filters.every(filter => filter(row)));
        const result = { data: matched.slice(call.start, Math.min(call.end + 1, call.max)), count: matched.length, error: table === failure ? { message: 'test failure' } : null };
        if (call.update && !result.error) matched.forEach(row => Object.assign(row, call.update));
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  } };
  return { db, calls };
}
function messaging(rows = {}, failure) {
  const fixture = storage(rows, failure);
  return { ...fixture, service: load('../src/lib/internalMessaging.ts', { './supabase/server': { getSupabaseAdmin: () => fixture.db }, './securityAudit': {}, './messagePagination': paging }) };
}

test('team and support links select the correct tab in both workspaces', () => {
  for (const base of ['/admin/berichten', '/praktijk/berichten']) {
    assert.equal(presentation.notificationHref({ threadId: id }, base), `${base}?view=team&thread=${id}`);
    assert.equal(presentation.notificationHref({ supportConversationId: other }, base), `${base}?view=support&conversation=${other}`);
  }
  assert.ok(presentation.notificationHref({ threadId: 'x&view=support' }, '/admin/berichten').includes('x%26view%3Dsupport'));
});

test('notification count is exact beyond the 20-item preview and excludes other recipients', async () => {
  const rows = Array.from({ length: 41 }, (_, i) => ({ id: String(i), recipient_user_id: id, notification_type: 'internal_message', read_at: null }));
  rows.push({ recipient_user_id: other, read_at: null }, { recipient_user_id: id, read_at: '2026-01-01' });
  const { service } = messaging({ internal_notifications: rows });
  const result = await service.getUnreadNotifications(id);
  assert.equal(result.unreadCount, 41);
  assert.equal(result.notifications.length, 20);
});

test('staff without support permission cannot receive old customer notification titles', async () => {
  const { service } = messaging({ internal_notifications: [
    { recipient_user_id: id, notification_type: 'internal_message', title: 'Team', read_at: null },
    { recipient_user_id: id, notification_type: 'support_message', title: 'Customer subject', read_at: null },
  ] });
  const result = await service.getUnreadNotifications(id);
  assert.equal(result.unreadCount, 1);
  assert.equal(result.notifications[0].title, 'Team');
  assert.equal((await service.getUnreadNotifications(id, true)).unreadCount, 2);
});

test('empty selection cannot mark all, invalid ids fail, and reads remain recipient scoped', async () => {
  const before = '2026-11-18T10:00:00.000Z';
  const rows = [
    { id, recipient_user_id: id, read_at: null, created_at: '2026-11-18T09:00:00.000Z' },
    { id: other, recipient_user_id: other, read_at: null, created_at: '2026-11-18T09:00:00.000Z' },
    { id: other, recipient_user_id: id, read_at: null, created_at: '2026-11-18T11:00:00.000Z' },
  ];
  const { service, calls } = messaging({ internal_notifications: rows });
  await service.markNotificationsRead(id, []);
  assert.equal(calls.length, 0);
  await assert.rejects(service.markNotificationsRead(id, ['invalid']), /invalid_input/);
  await service.markNotificationsRead(id, [id], before);
  assert.equal(rows[0].read_at, before);
  assert.equal(rows[1].read_at, null);
  await service.markNotificationsRead(id, undefined, before);
  assert.equal(rows[2].read_at, null, 'new arrivals survive read-all');
});

test('notification API rejects malformed and ambiguous requests without mutation', async () => {
  const writes = [];
  const route = load('../src/pages/api/internal/notifications.ts', { '../../../lib/internalMessaging': { markNotificationsRead: async (...args) => writes.push(args), getUnreadNotifications: async () => ({ notifications: [], unreadCount: 0 }) }, '../../../lib/adminAuth': auth });
  const context = body => ({ locals: { currentUser: user('support') }, request: new Request('http://localhost/api/internal/notifications', { method: 'POST', body }) });
  for (const body of ['{}', 'null', '[]', 'bad json', '{"ids":["invalid"]}', '{"all":true,"ids":[]}']) {
    assert.equal((await route.POST(context(body))).status, 400, body);
  }
  assert.equal(writes.length, 0);
  assert.equal((await route.POST(context(JSON.stringify({ ids: [] })))).status, 200);
  assert.equal((await route.POST(context(JSON.stringify({ all: true })))).status, 200);
  assert.equal(writes.length, 2);
  assert.equal(writes[1][1], undefined);
  assert.equal((await route.GET({ locals: {} })).status, 401);
  const result = await route.GET({ locals: { currentUser: user('support') } });
  assert.match(result.headers.get('cache-control'), /no-store/);
});

test('paged reads preserve all messages and fail instead of marking incomplete history read', async () => {
  const data = Array.from({ length: 1210 }, (_, index) => index);
  const offsets = [];
  const rows = await paging.readMessagePages((start, end) => { offsets.push(start); return Promise.resolve({ data: data.slice(start, end + 1), error: null }); });
  assert.equal(rows.length, 1210);
  assert.deepEqual(offsets, [0, 500, 1000]);
  await assert.rejects(paging.readMessagePages(() => Promise.resolve({ data: [], error: { message: 'unavailable' } })), /unavailable/);
});

function attention(rows = {}, failedTable, records = { patients: [], notes: [] }) {
  const fixture = storage(rows, failedTable);
  const service = load('../src/lib/adminAttention.ts', {
    './supabase/server': { getSupabaseAdmin: () => fixture.db }, './adminAuth': auth,
    './commerce/websiteMail': { websiteMailReady: () => true },
    './clientRecords': { getPracticeNoteTasks: async () => records }, './practiceWorkday': workday,
  });
  return { ...fixture, service };
}

test('support and employee attention never queries superadmin-only sources', async () => {
  for (const role of ['support', 'employee']) {
    const { calls, service } = attention();
    const result = await service.getAdminAttention(user(role), 'admin');
    assert.equal(result.unavailable.length, 0);
    for (const table of ['admin_work_items', 'analytics_events', 'products', 'content_items', 'integration_status', 'admin_recurring_costs', 'booking_mail_jobs']) assert.ok(!calls.some(call => call.table === table), `${role}: ${table}`);
    if (role === 'employee') assert.deepEqual([...new Set(calls.map(call => call.table))], ['internal_notifications']);
  }
});

test('superadmin attention covers open states and an unavailable source is never represented as zero', async () => {
  const { service, calls } = attention({ bookings: [{ status: 'pending' }, { status: 'cancelled' }], products: [{ status: 'review' }, { status: 'draft' }], data_subject_requests: [{ status: 'received' }, { status: 'resolved' }] }, 'support_conversations');
  const result = await service.getAdminAttention(user('super_admin'), 'admin');
  assert.equal(result.items.find(item => item.key === 'bookings').count, 1);
  assert.equal(result.items.find(item => item.key === 'products').count, 1);
  assert.equal(result.items.find(item => item.key === 'privacy').count, 1);
  assert.ok(result.unavailable.includes('support'));
  assert.ok(!result.items.some(item => item.key === 'support'));
  assert.ok(calls.filter(call => call.table.endsWith('_mail_jobs')).every(call => call.or.includes('status.eq.failed') && call.or.includes('lease_until.lt.')));
});

test('practice signals use only own pending bookings and authorized report tasks', async () => {
  const bookings = [
    { id: 'pending-own', practitioner_id: other, status: 'pending' },
    { id: 'pending-other', practitioner_id: id, status: 'pending' },
    { id: 'elapsed', practitioner_id: other, status: 'completed', starts_at: '2026-01-01T09:00:00Z', ends_at: '2026-01-01T10:00:00Z', patient_id: id },
    { id: 'private', practitioner_id: other, status: 'completed', starts_at: '2026-01-01T09:00:00Z', ends_at: '2026-01-01T10:00:00Z', patient_id: other },
  ];
  const { service, calls } = attention({ bookings }, '', { patients: [{ id, fullName: 'Private name' }], notes: [] });
  const result = await service.getAdminAttention(user('practitioner', { practitionerId: other }), 'practice');
  assert.equal(result.items.find(item => item.key === 'bookings').count, 1);
  assert.equal(result.items.find(item => item.key === 'reports').count, 1);
  assert.doesNotMatch(JSON.stringify(result), /Private name|private/);
  assert.deepEqual([...new Set(calls.map(call => call.table))].sort(), ['bookings', 'internal_notifications']);
});

test('shared report queue excludes cancellations, no-shows, noted bookings and other authors’ drafts', () => {
  const records = { patients: [{ id, fullName: 'Client' }], notes: [
    { id: 'draft', patient_id: id, booking_id: 'noted', status: 'draft', created_by: id },
    { id: 'other-draft', patient_id: id, booking_id: null, status: 'draft', created_by: other },
  ] };
  const bookings = ['completed', 'confirmed', 'cancelled', 'no_show'].map(status => ({ id: status, patientId: id, status, startsAt: '2026-01-01T09:00:00Z', endsAt: '2026-01-01T10:00:00Z' }));
  bookings.push({ ...bookings[0], id: 'noted' });
  const tasks = workday.buildPracticeTasks(user('practitioner'), records, bookings);
  assert.deepEqual(Array.from(tasks, task => task.id), ['draft', 'completed', 'confirmed']);
});

test('support dashboard does not read tasks, product statistics or analytics with the service key', async () => {
  const { db, calls } = storage();
  const service = load('../src/lib/superAdmin.ts', { './supabase/server': { getSupabaseAdmin: () => db }, './adminAuth': auth });
  const result = await service.getSuperadminOverview(user('support'));
  assert.equal(result.tasks.length, 0);
  assert.equal(result.analyticsEvents, 0);
  assert.deepEqual([...new Set(calls.map(call => call.table))].sort(), ['bookings', 'orders']);
  await assert.rejects(service.getSuperadminOverview(user('employee')), /forbidden/);
});
