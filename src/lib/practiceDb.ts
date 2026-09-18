import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export type UserRole = 'super_admin' | 'practitioner' | 'customer';

export type LocalUser = {
  id: string; email: string; name: string; passwordSalt: string; passwordHash: string;
  roles: UserRole[]; practitionerId: string | null; active: boolean; sessionVersion: number;
};

export type Practitioner = { id: string; slug: string; name: string; email: string; active: boolean };
export type PractitionerProfile = Practitioner & {
  publicRole: string; bio: string; expertise: string[]; languages: string[];
  appointmentDurationMinutes: number; minimumNoticeHours: number; bookingHorizonDays: number;
  requestsEnabled: boolean; profileUpdatedAt: string | null;
};
export type NotificationPreferences = { bookingEmailEnabled: boolean; bookingReminderEnabled: boolean; weeklyDigestEnabled: boolean; timezone: string };
export type SecurityActivity = { occurredAt: string; action: string; metadata: Record<string, unknown> };
export type CustomerBooking = { id: string; practitionerName: string; practitionerSlug: string; startsAt: string; endsAt: string; status: string };
export type CustomerTransaction = { id: string; createdAt: string; status: string; totalCents: number; currency: string };
export type CustomerEntitlement = { id: string; productTitle: string; productSlug: string; productType: string; status: string; grantedAt: string };
let database: DatabaseSync | null = null;
const readCredential = (key: string) => String(import.meta.env[key] || '').trim();

const seedUsers = (db: DatabaseSync) => {
  const practitioners: Practitioner[] = [
    { id: 'prac_virginie', slug: 'virginie', name: 'Virginie', email: 'virginie@mygrowise.com', active: true },
    { id: 'prac_margot', slug: 'margot', name: 'Margot', email: 'margot@mygrowise.com', active: true },
    { id: 'prac_amy', slug: 'amy', name: 'Amy', email: 'amy@mygrowise.com', active: true },
  ];
  const users = [
    { id: 'usr_virginie', email: 'virginie@mygrowise.com', name: 'Virginie', salt: readCredential('ADMIN_PASSWORD_SALT'), hash: readCredential('ADMIN_PASSWORD_HASH'), roles: ['super_admin', 'practitioner'] satisfies UserRole[], practitionerId: 'prac_virginie' },
    { id: 'usr_margot', email: 'margot@mygrowise.com', name: 'Margot', salt: readCredential('MARGOT_PASSWORD_SALT'), hash: readCredential('MARGOT_PASSWORD_HASH'), roles: ['practitioner'] satisfies UserRole[], practitionerId: 'prac_margot' },
    { id: 'usr_amy', email: 'amy@mygrowise.com', name: 'Amy', salt: readCredential('AMY_PASSWORD_SALT'), hash: readCredential('AMY_PASSWORD_HASH'), roles: ['practitioner'] satisfies UserRole[], practitionerId: 'prac_amy' },
  ];
  // Seeds only create the initial local accounts. They must never overwrite a professional's own profile or email after a restart.
  const insertPractitioner = db.prepare('INSERT INTO practitioners (id, slug, name, email, active) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
  for (const p of practitioners) insertPractitioner.run(p.id, p.slug, p.name, p.email, p.active ? 1 : 0);
  const insertUser = db.prepare('INSERT INTO users (id, email, name, password_salt, password_hash, roles, practitioner_id, active, session_version) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1) ON CONFLICT(id) DO NOTHING');
  for (const u of users) if (/^[a-f0-9]{32,}$/i.test(u.salt) && /^[a-f0-9]{128}$/i.test(u.hash)) insertUser.run(u.id, u.email, u.name, u.salt, u.hash, JSON.stringify(u.roles), u.practitionerId);
  const profileSeeds = [
    ['prac_virginie', 'Oprichter van MyGrowise', 'Ik begeleid volwassenen die opnieuw rust, richting en vertrouwen willen vinden in hun dagelijks leven.', 'Stress, Emotionele belasting, Traumagerichte begeleiding', 'Nederlands, Engels'],
    ['prac_margot', 'Erkend klinisch psycholoog', 'Ik bied online psychologische begeleiding met ruimte voor jouw verhaal, tempo en doelen.', 'Online begeleiding, EMDR, Angst en stress', 'Nederlands, Engels'],
    ['prac_amy', 'Seksuoloog', 'Ik begeleid rond intimiteit, relaties, lichaamsbeleving en seksueel welzijn in een veilige online setting.', 'Intimiteit, Relaties, Seksueel welzijn', 'Nederlands, Engels'],
  ];
  const seedProfile = db.prepare("UPDATE practitioners SET public_role = ?, bio = ?, expertise = ?, languages = ? WHERE id = ? AND COALESCE(public_role, '') = ''");
  for (const [id, role, bio, expertise, languages] of profileSeeds) seedProfile.run(role, bio, JSON.stringify(expertise.split(', ')), JSON.stringify(languages.split(', ')), id);
};

export const getPracticeDb = () => {
  if (database) return database;
  const directory = process.env.ADMIN_DATA_DIR || path.join(process.cwd(), 'data', 'admin');
  mkdirSync(directory, { recursive: true });
  database = new DatabaseSync(path.join(directory, 'mygrowise.sqlite'));
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS practitioners (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), public_role TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', expertise TEXT NOT NULL DEFAULT '[]', languages TEXT NOT NULL DEFAULT '[]', appointment_duration_minutes INTEGER NOT NULL DEFAULT 60, minimum_notice_hours INTEGER NOT NULL DEFAULT 2, booking_horizon_days INTEGER NOT NULL DEFAULT 30, requests_enabled INTEGER NOT NULL DEFAULT 1 CHECK(requests_enabled IN (0,1)), profile_updated_at TEXT, profile_updated_by TEXT);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, roles TEXT NOT NULL, practitioner_id TEXT REFERENCES practitioners(id), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), session_version INTEGER NOT NULL DEFAULT 1, last_login_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS availability_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE, weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7), start_time TEXT NOT NULL, end_time TEXT NOT NULL, UNIQUE(practitioner_id, weekday, start_time, end_time));
    CREATE TABLE IF NOT EXISTS availability_exceptions (id TEXT PRIMARY KEY, practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('available','unavailable')), private_reason TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, practitioner_id TEXT NOT NULL REFERENCES practitioners(id), client_name TEXT NOT NULL, client_email TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','declined','cancelled','completed','no_show')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS bookings_practitioner_start ON bookings(practitioner_id, starts_at);
    CREATE TABLE IF NOT EXISTS practice_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, actor_user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, object_type TEXT NOT NULL, object_id TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS user_preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, booking_email_enabled INTEGER NOT NULL DEFAULT 1 CHECK(booking_email_enabled IN (0,1)), booking_reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK(booking_reminder_enabled IN (0,1)), weekly_digest_enabled INTEGER NOT NULL DEFAULT 0 CHECK(weekly_digest_enabled IN (0,1)), timezone TEXT NOT NULL DEFAULT 'Europe/Brussels');
    CREATE TABLE IF NOT EXISTS customer_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('draft','pending_payment','paid','fulfilled','cancelled','partially_refunded','refunded','disputed')), total_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL, product_title TEXT NOT NULL, product_slug TEXT NOT NULL, product_type TEXT NOT NULL, price_cents INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS entitlements (id TEXT PRIMARY KEY, customer_user_id TEXT NOT NULL REFERENCES users(id), order_item_id TEXT REFERENCES order_items(id), product_id TEXT NOT NULL, product_title TEXT NOT NULL, product_slug TEXT NOT NULL, product_type TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','revoked')), granted_at TEXT NOT NULL, revoked_at TEXT);
    CREATE INDEX IF NOT EXISTS orders_customer_created ON orders(customer_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS entitlements_customer_granted ON entitlements(customer_user_id, granted_at DESC);
    CREATE TABLE IF NOT EXISTS practice_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
  `);
  // Older installations allowed only one continuous period per weekday. Rebuild the
  // small rules table once so professionals can publish split shifts on the same day.
  const availabilityTable = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'availability_rules'").get() as { sql?: string } | undefined;
  if (availabilityTable?.sql?.includes('UNIQUE(practitioner_id, weekday)')) {
    database.exec(`
      BEGIN IMMEDIATE;
      ALTER TABLE availability_rules RENAME TO availability_rules_single_period;
      CREATE TABLE availability_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE, weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7), start_time TEXT NOT NULL, end_time TEXT NOT NULL, UNIQUE(practitioner_id, weekday, start_time, end_time));
      INSERT INTO availability_rules (id, practitioner_id, weekday, start_time, end_time) SELECT id, practitioner_id, weekday, start_time, end_time FROM availability_rules_single_period;
      DROP TABLE availability_rules_single_period;
      COMMIT;
    `);
  }
  const columns = new Set((database.prepare('PRAGMA table_info(practitioners)').all() as any[]).map((row) => String(row.name)));
  const addColumn = (name: string, definition: string) => { if (!columns.has(name)) database!.exec(`ALTER TABLE practitioners ADD COLUMN ${definition}`); };
  addColumn('public_role', "public_role TEXT NOT NULL DEFAULT ''");
  addColumn('bio', "bio TEXT NOT NULL DEFAULT ''");
  addColumn('expertise', "expertise TEXT NOT NULL DEFAULT '[]'");
  addColumn('languages', "languages TEXT NOT NULL DEFAULT '[]'");
  addColumn('appointment_duration_minutes', 'appointment_duration_minutes INTEGER NOT NULL DEFAULT 60');
  addColumn('minimum_notice_hours', 'minimum_notice_hours INTEGER NOT NULL DEFAULT 2');
  addColumn('booking_horizon_days', 'booking_horizon_days INTEGER NOT NULL DEFAULT 30');
  addColumn('requests_enabled', 'requests_enabled INTEGER NOT NULL DEFAULT 1');
  addColumn('profile_updated_at', 'profile_updated_at TEXT');
  addColumn('profile_updated_by', 'profile_updated_by TEXT');
  const bookingColumns = new Set((database.prepare('PRAGMA table_info(bookings)').all() as any[]).map((row) => String(row.name)));
  if (!bookingColumns.has('customer_user_id')) database.exec('ALTER TABLE bookings ADD COLUMN customer_user_id TEXT REFERENCES users(id)');
  if (!bookingColumns.has('calendar_booked_at')) database.exec('ALTER TABLE bookings ADD COLUMN calendar_booked_at TEXT');
  database.exec('CREATE INDEX IF NOT EXISTS bookings_customer_start ON bookings(customer_user_id, starts_at)');
  seedUsers(database);
  // The original untouched 24-hour default made every same-day slot disappear.
  // Preserve deliberate profile choices, but give unconfigured profiles the new
  // two-hour preparation window once.
  if (!database.prepare('SELECT 1 FROM practice_migrations WHERE id = ?').get('same_day_notice_v1')) {
    database.prepare('UPDATE practitioners SET minimum_notice_hours = 2 WHERE minimum_notice_hours = 24 AND profile_updated_at IS NULL').run();
    database.prepare('INSERT INTO practice_migrations (id, applied_at) VALUES (?, ?)').run('same_day_notice_v1', new Date().toISOString());
  }
  return database;
};

const rowToUser = (row: Record<string, unknown> | undefined): LocalUser | null => row ? ({ id: String(row.id), email: String(row.email), name: String(row.name), passwordSalt: String(row.password_salt), passwordHash: String(row.password_hash), roles: JSON.parse(String(row.roles)) as UserRole[], practitionerId: row.practitioner_id ? String(row.practitioner_id) : null, active: Boolean(row.active), sessionVersion: Number(row.session_version) }) : null;
export const getUserByEmail = (email: string) => rowToUser(getPracticeDb().prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as Record<string, unknown> | undefined);
export const getUserById = (id: string) => rowToUser(getPracticeDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined);
export const getUserLastLogin = (id: string) => {
  const row = getPracticeDb().prepare('SELECT last_login_at FROM users WHERE id = ?').get(id) as { last_login_at?: string | null } | undefined;
  return row?.last_login_at || null;
};
export const recordUserLogin = (id: string) => {
  const db = getPracticeDb(); const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, id);
  db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id) VALUES (?, ?, ?, ?, ?)').run(now, id, 'account.login', 'user', id);
};
export const listPractitioners = () => getPracticeDb().prepare('SELECT id, slug, name, email, active FROM practitioners ORDER BY name').all().map((row: any) => ({ ...row, active: Boolean(row.active) })) as Practitioner[];
export const getPractitioner = (id: string) => { const row = getPracticeDb().prepare('SELECT id, slug, name, email, active FROM practitioners WHERE id = ?').get(id) as any; return row ? { ...row, active: Boolean(row.active) } as Practitioner : null; };
export const listPractitionerAccounts = () => getPracticeDb().prepare(`
  SELECT p.id, p.slug, p.name, p.email, p.active, u.last_login_at,
    (SELECT COUNT(DISTINCT ar.weekday) FROM availability_rules ar WHERE ar.practitioner_id = p.id) AS availability_days,
    (SELECT COUNT(*) FROM bookings b WHERE b.practitioner_id = p.id AND b.status = 'pending') AS pending_bookings
  FROM practitioners p LEFT JOIN users u ON u.practitioner_id = p.id ORDER BY p.name
`).all() as Array<{ id: string; slug: string; name: string; email: string; active: number; last_login_at: string | null; availability_days: number; pending_bookings: number }>;

const safeList = (value: unknown, maximum: number) => {
  try { const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean).slice(0, maximum) : []; } catch { return []; }
};
const rowToProfile = (row: any): PractitionerProfile | null => row ? ({
  id: String(row.id), slug: String(row.slug), name: String(row.name), email: String(row.email), active: Boolean(row.active),
  publicRole: String(row.public_role || ''), bio: String(row.bio || ''), expertise: safeList(row.expertise, 8), languages: safeList(row.languages, 6),
  appointmentDurationMinutes: Number(row.appointment_duration_minutes ?? 60), minimumNoticeHours: Number(row.minimum_notice_hours ?? 2), bookingHorizonDays: Number(row.booking_horizon_days ?? 30), requestsEnabled: Boolean(row.requests_enabled), profileUpdatedAt: row.profile_updated_at ? String(row.profile_updated_at) : null,
}) : null;
export const getPractitionerProfile = (id: string) => rowToProfile(getPracticeDb().prepare('SELECT * FROM practitioners WHERE id = ?').get(id));
const parseList = (value: string, maximum: number) => Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim().replace(/\s+/g, ' ')).filter((item) => item.length >= 2 && item.length <= 60))).slice(0, maximum);
const oneOfNumber = (value: unknown, allowed: number[], fallback: number) => allowed.includes(Number(value)) ? Number(value) : fallback;
export const updateOwnPractitionerProfile = (practitionerId: string, actorUserId: string, input: { name: string; publicRole: string; bio: string; expertise: string; languages: string; appointmentDurationMinutes: unknown; minimumNoticeHours: unknown; bookingHorizonDays: unknown; requestsEnabled: boolean }) => {
  const name = input.name.trim().replace(/\s+/g, ' '); const publicRole = input.publicRole.trim().replace(/\s+/g, ' '); const bio = input.bio.trim().replace(/\s+/g, ' ');
  const expertise = parseList(input.expertise, 8); const languages = parseList(input.languages, 6);
  if (name.length < 2 || name.length > 80 || publicRole.length < 2 || publicRole.length > 100 || bio.length < 40 || bio.length > 1200 || expertise.length === 0 || languages.length === 0) throw new Error('invalid_profile');
  const duration = oneOfNumber(input.appointmentDurationMinutes, [45, 60, 75, 90], 60);
  const notice = oneOfNumber(input.minimumNoticeHours, [0, 1, 2, 4, 12, 24, 48, 72], 2);
  const horizon = oneOfNumber(input.bookingHorizonDays, [14, 30, 45, 60, 90], 30);
  const db = getPracticeDb(); const now = new Date().toISOString(); db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE practitioners SET name = ?, public_role = ?, bio = ?, expertise = ?, languages = ?, appointment_duration_minutes = ?, minimum_notice_hours = ?, booking_horizon_days = ?, requests_enabled = ?, profile_updated_at = ?, profile_updated_by = ? WHERE id = ?').run(name, publicRole, bio, JSON.stringify(expertise), JSON.stringify(languages), duration, notice, horizon, input.requestsEnabled ? 1 : 0, now, actorUserId, practitionerId);
    db.prepare('UPDATE users SET name = ? WHERE id = ? AND practitioner_id = ?').run(name, actorUserId, practitionerId);
    db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(now, actorUserId, 'profile.updated', 'practitioner', practitionerId, JSON.stringify({ duration, notice, horizon, requestsEnabled: input.requestsEnabled }));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
};
export const getNotificationPreferences = (userId: string): NotificationPreferences => {
  const db = getPracticeDb(); db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(userId);
  const row = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId) as any;
  return { bookingEmailEnabled: Boolean(row.booking_email_enabled), bookingReminderEnabled: Boolean(row.booking_reminder_enabled), weeklyDigestEnabled: Boolean(row.weekly_digest_enabled), timezone: String(row.timezone || 'Europe/Brussels') };
};
export const updateNotificationPreferences = (userId: string, input: Omit<NotificationPreferences, 'timezone'>) => {
  const db = getPracticeDb(); db.prepare('INSERT INTO user_preferences (user_id, booking_email_enabled, booking_reminder_enabled, weekly_digest_enabled) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET booking_email_enabled=excluded.booking_email_enabled, booking_reminder_enabled=excluded.booking_reminder_enabled, weekly_digest_enabled=excluded.weekly_digest_enabled').run(userId, input.bookingEmailEnabled ? 1 : 0, input.bookingReminderEnabled ? 1 : 0, input.weeklyDigestEnabled ? 1 : 0);
  db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id) VALUES (?, ?, ?, ?, ?)').run(new Date().toISOString(), userId, 'account.notifications_updated', 'user', userId);
};
export const updateOwnEmail = (userId: string, practitionerId: string, email: string) => {
  const normalized = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('invalid_email');
  const db = getPracticeDb(); const duplicate = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?').get(normalized, userId); if (duplicate) throw new Error('email_taken');
  db.exec('BEGIN IMMEDIATE'); try { db.prepare('UPDATE users SET email = ?, session_version = session_version + 1 WHERE id = ?').run(normalized, userId); db.prepare('UPDATE practitioners SET email = ? WHERE id = ?').run(normalized, practitionerId); db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id) VALUES (?, ?, ?, ?, ?)').run(new Date().toISOString(), userId, 'account.email_updated', 'user', userId); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getUserById(userId)!;
};
export const updateOwnPassword = (userId: string, salt: string, hash: string) => { const db = getPracticeDb(); db.prepare('UPDATE users SET password_salt = ?, password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(salt, hash, userId); db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id) VALUES (?, ?, ?, ?, ?)').run(new Date().toISOString(), userId, 'account.password_updated', 'user', userId); return getUserById(userId)!; };
export const revokeAllUserSessions = (userId: string) => { const db = getPracticeDb(); db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(userId); db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id) VALUES (?, ?, ?, ?, ?)').run(new Date().toISOString(), userId, 'account.sessions_revoked', 'user', userId); };
export const listOwnSecurityActivity = (userId: string) => getPracticeDb().prepare("SELECT occurred_at, action, metadata FROM practice_audit_log WHERE actor_user_id = ? AND action LIKE 'account.%' ORDER BY id DESC LIMIT 12").all(userId).map((row: any) => ({ occurredAt: String(row.occurred_at), action: String(row.action), metadata: (() => { try { return JSON.parse(String(row.metadata)); } catch { return {}; } })() })) as SecurityActivity[];

const validCustomerName = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 100);
export const createCustomerAccount = (input: { name: string; email: string; passwordSalt: string; passwordHash: string }) => {
  const name = validCustomerName(input.name); const email = input.email.trim().toLowerCase();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('invalid_customer');
  const db = getPracticeDb();
  if (db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email)) throw new Error('email_taken');
  const id = `cus_${randomUUID()}`; const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO users (id, email, name, password_salt, password_hash, roles, practitioner_id, active, session_version) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 1)').run(id, email, name, input.passwordSalt, input.passwordHash, JSON.stringify(['customer']));
    db.prepare('INSERT INTO customer_profiles (user_id, created_at, updated_at) VALUES (?, ?, ?)').run(id, now, now);
    db.prepare('UPDATE bookings SET customer_user_id = ? WHERE customer_user_id IS NULL AND client_email = ? COLLATE NOCASE').run(id, email);
    db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id) VALUES (?, ?, ?, ?, ?)').run(now, id, 'account.created', 'customer', id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getUserById(id)!;
};

export const listCustomerBookings = (userId: string) => getPracticeDb().prepare(`
  SELECT b.id, p.name AS practitioner_name, p.slug AS practitioner_slug, b.starts_at, b.ends_at, b.status
  FROM bookings b JOIN practitioners p ON p.id = b.practitioner_id
  WHERE b.customer_user_id = ? ORDER BY b.starts_at DESC
`).all(userId).map((row: any) => ({ id: String(row.id), practitionerName: String(row.practitioner_name), practitionerSlug: String(row.practitioner_slug), startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status) })) as CustomerBooking[];

export const listCustomerTransactions = (userId: string) => getPracticeDb().prepare('SELECT id, created_at, status, total_cents, currency FROM orders WHERE customer_user_id = ? ORDER BY created_at DESC').all(userId).map((row: any) => ({ id: String(row.id), createdAt: String(row.created_at), status: String(row.status), totalCents: Number(row.total_cents), currency: String(row.currency) })) as CustomerTransaction[];

export const listCustomerEntitlements = (userId: string) => getPracticeDb().prepare('SELECT id, product_title, product_slug, product_type, status, granted_at FROM entitlements WHERE customer_user_id = ? ORDER BY granted_at DESC').all(userId).map((row: any) => ({ id: String(row.id), productTitle: String(row.product_title), productSlug: String(row.product_slug), productType: String(row.product_type), status: String(row.status), grantedAt: String(row.granted_at) })) as CustomerEntitlement[];

export const cancelOwnCustomerBooking = (bookingId: string, userId: string) => {
  const db = getPracticeDb(); const booking = db.prepare(`SELECT b.*, p.minimum_notice_hours FROM bookings b JOIN practitioners p ON p.id = b.practitioner_id WHERE b.id = ? AND b.customer_user_id = ?`).get(bookingId, userId) as any;
  if (!booking || !['pending', 'confirmed'].includes(String(booking.status))) throw new Error('not_found');
  if (new Date(booking.starts_at).getTime() < Date.now() + Number(booking.minimum_notice_hours) * 3600000) throw new Error('too_late');
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ? AND customer_user_id = ? AND status IN ('pending','confirmed')").run(now, bookingId, userId);
    db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id) VALUES (?, ?, ?, ?, ?)').run(now, userId, 'booking.cancelled_by_customer', 'booking', bookingId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
};
