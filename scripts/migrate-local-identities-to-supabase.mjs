import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.');

const database = new DatabaseSync(new URL('../data/admin/mygrowise.sqlite', import.meta.url), { readOnly: true });
const localUsers = database.prepare('select id, email, name, roles, practitioner_id from users order by id').all();
const localPreferences = database.prepare('select * from user_preferences').all();
const localBookings = database.prepare('select id, customer_user_id from bookings where customer_user_id is not null').all();
const localAudit = database.prepare('select id, occurred_at, actor_user_id, action, object_type, object_id, metadata from practice_audit_log order by id').all();
const localPractitioners = database.prepare('select id, slug from practitioners').all();
const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const users = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const remoteByEmail = new Map(users.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user]));
const remoteIdByLegacyId = new Map();

for (const local of localUsers) {
  const email = String(local.email).trim().toLowerCase();
  let remote = remoteByEmail.get(email);
  if (!remote) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      // No email is sent and no legacy password is reused. The random credential
      // makes the account inaccessible until the controlled reset flow is used.
      password: `${randomBytes(48).toString('base64url')}Aa1!`,
      email_confirm: true,
      user_metadata: { full_name: String(local.name), legacy_imported: true, password_reset_required: true },
    });
    if (error || !data.user) throw error || new Error(`Could not create ${email}`);
    remote = data.user;
    remoteByEmail.set(email, remote);
  }
  remoteIdByLegacyId.set(String(local.id), remote.id);
  const roles = JSON.parse(String(local.roles));
  const { error: profileError } = await client.from('profiles').upsert({ id: remote.id, full_name: String(local.name), timezone: 'Europe/Brussels' });
  if (profileError) throw profileError;
  const { error: roleError } = await client.from('user_roles').upsert(roles.map((role) => ({ user_id: remote.id, role })), { onConflict: 'user_id,role' });
  if (roleError) throw roleError;
}

const remotePractitioners = new Map();
const { data: practitionerRows, error: practitionerError } = await client.from('practitioners').select('id,slug');
if (practitionerError) throw practitionerError;
for (const row of practitionerRows) remotePractitioners.set(row.slug, row.id);
const localSlugById = new Map(localPractitioners.map((row) => [String(row.id), String(row.slug)]));
for (const local of localUsers) {
  if (!local.practitioner_id) continue;
  const remoteUserId = remoteIdByLegacyId.get(String(local.id));
  const remotePractitionerId = remotePractitioners.get(localSlugById.get(String(local.practitioner_id)));
  if (!remoteUserId || !remotePractitionerId) continue;
  const { error } = await client.from('practitioners').update({ user_id: remoteUserId }).eq('id', remotePractitionerId);
  if (error) throw error;
}

if (localPreferences.length) {
  const preferences = localPreferences.flatMap((row) => {
    const user_id = remoteIdByLegacyId.get(String(row.user_id));
    return user_id ? [{ user_id, booking_email_enabled: Boolean(row.booking_email_enabled), booking_reminder_enabled: Boolean(row.booking_reminder_enabled), weekly_digest_enabled: Boolean(row.weekly_digest_enabled), timezone: String(row.timezone || 'Europe/Brussels') }] : [];
  });
  if (preferences.length) {
    const { error } = await client.from('user_preferences').upsert(preferences, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

for (const booking of localBookings) {
  const customer_user_id = remoteIdByLegacyId.get(String(booking.customer_user_id));
  if (!customer_user_id) continue;
  const { error } = await client.from('bookings').update({ customer_user_id }).eq('legacy_source_id', String(booking.id));
  if (error) throw error;
}

const auditRecords = localAudit.flatMap((row) => [{
  legacy_source_id: `practice_audit:${row.id}`,
  occurred_at: String(row.occurred_at), actor_user_id: remoteIdByLegacyId.get(String(row.actor_user_id)) || null,
  action: String(row.action), object_type: String(row.object_type), object_id: String(row.object_id),
  metadata: (() => { try { return JSON.parse(String(row.metadata || '{}')); } catch { return {}; } })(),
}]);
if (auditRecords.length) {
  const { error } = await client.from('security_audit_log').upsert(auditRecords, { onConflict: 'legacy_source_id' });
  if (error) throw error;
}

console.log(`Migrated ${localUsers.length} identities, ${localPreferences.length} preferences, ${localBookings.length} booking links and ${auditRecords.length} audit events.`);
