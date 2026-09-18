import { randomUUID } from 'node:crypto';
import { getPracticeDb, getPractitioner, getPractitionerProfile, listPractitioners } from './practiceDb';

export type AvailabilityRule = { weekday: number; startTime: string; endTime: string };
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed' | 'no_show';
export type PracticeBooking = { id: string; practitionerId: string; clientName: string; clientEmail: string; startsAt: string; endsAt: string; status: BookingStatus; calendarBookedAt: string | null; createdAt: string; updatedAt: string };
export type BookableSlot = { practitionerId: string; practitionerSlug: string; startsAt: string; endsAt: string; dateLabel: string; timeLabel: string };
export type AvailabilityException = { id: string; practitionerId: string; startsAt: string; endsAt: string; kind: 'available' | 'unavailable'; privateReason: string | null; createdAt: string };

const TIME_ZONE = 'Europe/Brussels';
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const rowToRule = (row: any): AvailabilityRule => ({ weekday: Number(row.weekday), startTime: String(row.start_time), endTime: String(row.end_time) });
const rowToBooking = (row: any): PracticeBooking => ({ id: String(row.id), practitionerId: String(row.practitioner_id), clientName: String(row.client_name), clientEmail: String(row.client_email), startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: row.status as BookingStatus, calendarBookedAt: row.calendar_booked_at ? String(row.calendar_booked_at) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) });

export const getAvailabilityRules = (practitionerId: string) => getPracticeDb().prepare('SELECT weekday, start_time, end_time FROM availability_rules WHERE practitioner_id = ? ORDER BY weekday, start_time').all(practitionerId).map(rowToRule);

export const saveAvailabilityRules = (practitionerId: string, actorUserId: string, rules: AvailabilityRule[]) => {
  const normalized = rules.filter((rule) => Number.isInteger(rule.weekday) && rule.weekday >= 1 && rule.weekday <= 7 && timePattern.test(rule.startTime) && timePattern.test(rule.endTime) && rule.startTime < rule.endTime);
  if (normalized.length !== rules.length) throw new Error('invalid_availability');
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const periods = normalized.filter((rule) => rule.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (periods.length > 4 || periods.some((period, index) => index > 0 && period.startTime < periods[index - 1].endTime)) throw new Error('invalid_availability');
  }
  const db = getPracticeDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM availability_rules WHERE practitioner_id = ?').run(practitionerId);
    const insert = db.prepare('INSERT INTO availability_rules (practitioner_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)');
    for (const rule of normalized) insert.run(practitionerId, rule.weekday, rule.startTime, rule.endTime);
    db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(new Date().toISOString(), actorUserId, 'availability.updated', 'practitioner', practitionerId, JSON.stringify({ rules: normalized }));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const rowToException = (row: any): AvailabilityException => ({ id: String(row.id), practitionerId: String(row.practitioner_id), startsAt: String(row.starts_at), endsAt: String(row.ends_at), kind: row.kind as AvailabilityException['kind'], privateReason: row.private_reason ? String(row.private_reason) : null, createdAt: String(row.created_at) });
export const listAvailabilityExceptions = (practitionerId: string) => getPracticeDb().prepare('SELECT * FROM availability_exceptions WHERE practitioner_id = ? AND ends_at >= ? ORDER BY starts_at LIMIT 50').all(practitionerId, new Date().toISOString()).map(rowToException);

export const createAvailabilityException = (practitionerId: string, actorUserId: string, startsAt: string, endsAt: string, privateReason: string) => {
  const start = new Date(startsAt); const end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 366 * 86400000) throw new Error('invalid_exception');
  const exception: AvailabilityException = { id: `avail_${randomUUID()}`, practitionerId, startsAt: start.toISOString(), endsAt: end.toISOString(), kind: 'unavailable', privateReason: privateReason.trim().slice(0, 80) || null, createdAt: new Date().toISOString() };
  const db = getPracticeDb();
  db.prepare('INSERT INTO availability_exceptions (id, practitioner_id, starts_at, ends_at, kind, private_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(exception.id, practitionerId, exception.startsAt, exception.endsAt, exception.kind, exception.privateReason, exception.createdAt);
  db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(exception.createdAt, actorUserId, 'availability.exception_created', 'availability_exception', exception.id, JSON.stringify({ practitionerId, startsAt: exception.startsAt, endsAt: exception.endsAt }));
  return exception;
};

export const deleteAvailabilityException = (id: string, practitionerId: string, actorUserId: string) => {
  const db = getPracticeDb();
  const exception = db.prepare('SELECT * FROM availability_exceptions WHERE id = ? AND practitioner_id = ?').get(id, practitionerId) as any;
  if (!exception) throw new Error('not_found');
  db.prepare('DELETE FROM availability_exceptions WHERE id = ? AND practitioner_id = ?').run(id, practitionerId);
  db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(new Date().toISOString(), actorUserId, 'availability.exception_deleted', 'availability_exception', id, JSON.stringify({ practitionerId }));
};

export const listBookings = (practitionerId: string, status?: BookingStatus) => {
  const query = status ? 'SELECT * FROM bookings WHERE practitioner_id = ? AND status = ? ORDER BY starts_at' : 'SELECT * FROM bookings WHERE practitioner_id = ? ORDER BY starts_at';
  const rows = status ? getPracticeDb().prepare(query).all(practitionerId, status) : getPracticeDb().prepare(query).all(practitionerId);
  return rows.map(rowToBooking);
};

const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'declined'], confirmed: ['cancelled', 'completed', 'no_show'], declined: [], cancelled: [], completed: [], no_show: [],
};

export const updateBookingStatus = (bookingId: string, practitionerId: string, actorUserId: string, nextStatus: BookingStatus) => {
  const db = getPracticeDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND practitioner_id = ?').get(bookingId, practitionerId) as any;
    if (!booking) throw new Error('not_found');
    if (!transitions[booking.status as BookingStatus]?.includes(nextStatus)) throw new Error('invalid_transition');
    const now = new Date().toISOString();
    db.prepare('UPDATE bookings SET status = ?, updated_at = ?, calendar_booked_at = CASE WHEN ? = \'confirmed\' THEN ? ELSE calendar_booked_at END WHERE id = ? AND practitioner_id = ?').run(nextStatus, now, nextStatus, now, bookingId, practitionerId);
    db.prepare('INSERT INTO practice_audit_log (occurred_at, actor_user_id, action, object_type, object_id, metadata) VALUES (?, ?, ?, ?, ?, ?)').run(now, actorUserId, 'booking.status_updated', 'booking', bookingId, JSON.stringify({ from: booking.status, to: nextStatus, practitionerId }));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

const partsInZone = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
const localToUtc = (date: string, time: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let result = new Date(Date.UTC(year, month - 1, day, hour, minute));
  for (let i = 0; i < 2; i += 1) {
    const p = partsInZone(result);
    const rendered = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    result = new Date(result.getTime() - (rendered - Date.UTC(year, month - 1, day, hour, minute)));
  }
  return result;
};

const dateKeyInZone = (date: Date) => {
  const p = partsInZone(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

const weekdayInZone = (date: Date) => {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(date);
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[label];
};

export const getBookableSlots = (practitionerId: string, days = 14): BookableSlot[] => {
  const practitioner = getPractitionerProfile(practitionerId);
  if (!practitioner?.active || !practitioner.requestsEnabled) return [];
  const durationMinutes = practitioner.appointmentDurationMinutes;
  const rules = Map.groupBy(getAvailabilityRules(practitionerId), (rule) => rule.weekday);
  const now = new Date();
  const todayKey = dateKeyInZone(now);
  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const from = now.toISOString();
  const visibleDays = Math.min(Math.max(days, 1), practitioner.bookingHorizonDays);
  const until = new Date(now.getTime() + visibleDays * 86400000).toISOString();
  const bookings = listBookings(practitionerId).filter((booking) => ['pending', 'confirmed'].includes(booking.status) && booking.endsAt >= from && booking.startsAt <= until);
  const exceptions = getPracticeDb().prepare('SELECT starts_at, ends_at, kind FROM availability_exceptions WHERE practitioner_id = ? AND ends_at >= ? AND starts_at <= ?').all(practitionerId, from, until) as any[];
  const slots: BookableSlot[] = [];

  for (let offset = 0; offset < visibleDays; offset += 1) {
    // Anchor every calendar day at UTC noon. Adding twelve hours to the current
    // clock time can cross midnight and used to make "today" disappear after noon.
    const dayReference = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + offset, 12));
    const dayRules = rules.get(weekdayInZone(dayReference)) || [];
    if (!dayRules.length) continue;
    const dateKey = dateKeyInZone(dayReference);
    for (const rule of dayRules) {
      let cursor = localToUtc(dateKey, rule.startTime);
      const boundary = localToUtc(dateKey, rule.endTime);
      while (cursor.getTime() + durationMinutes * 60000 <= boundary.getTime()) {
        const end = new Date(cursor.getTime() + durationMinutes * 60000);
        const isFuture = cursor.getTime() >= now.getTime() + practitioner.minimumNoticeHours * 3600000;
        const overlapsBooking = bookings.some((booking) => new Date(booking.startsAt) < end && new Date(booking.endsAt) > cursor);
        const unavailable = exceptions.some((exception) => exception.kind === 'unavailable' && new Date(exception.starts_at) < end && new Date(exception.ends_at) > cursor);
        if (isFuture && !overlapsBooking && !unavailable) slots.push({ practitionerId, practitionerSlug: practitioner.slug, startsAt: cursor.toISOString(), endsAt: end.toISOString(), dateLabel: new Intl.DateTimeFormat('nl-BE', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(cursor), timeLabel: new Intl.DateTimeFormat('nl-BE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(cursor) });
        cursor = end;
      }
    }
  }
  return slots;
};

export const getPracticeSummary = (practitionerId: string) => {
  const bookings = listBookings(practitionerId);
  const now = new Date().toISOString();
  return { pending: bookings.filter((booking) => booking.status === 'pending').length, upcoming: bookings.filter((booking) => booking.status === 'confirmed' && booking.startsAt >= now).length, availabilityDays: new Set(getAvailabilityRules(practitionerId).map((rule) => rule.weekday)).size, nextSlots: getBookableSlots(practitionerId, 14).slice(0, 4) };
};

export const getPractitionerBySlug = (slug: string) => listPractitioners().find((practitioner) => practitioner.slug === slug && practitioner.active) || null;

export const createBookingRequest = (practitionerId: string, clientName: string, clientEmail: string, startsAt: string, endsAt: string) => {
  const horizon = getPractitionerProfile(practitionerId)?.bookingHorizonDays || 30;
  const available = getBookableSlots(practitionerId, horizon).some((slot) => slot.startsAt === startsAt && slot.endsAt === endsAt);
  if (!available) throw new Error('slot_unavailable');
  const db = getPracticeDb();
  const id = `book_${randomUUID()}`;
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const overlap = db.prepare("SELECT 1 FROM bookings WHERE practitioner_id = ? AND status IN ('pending','confirmed') AND starts_at < ? AND ends_at > ? LIMIT 1").get(practitionerId, endsAt, startsAt);
    if (overlap) throw new Error('slot_unavailable');
    const customer = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND roles LIKE '%customer%' LIMIT 1").get(clientEmail.trim().toLowerCase()) as any;
    db.prepare('INSERT INTO bookings (id, practitioner_id, client_name, client_email, customer_user_id, starts_at, ends_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, practitionerId, clientName, clientEmail.trim().toLowerCase(), customer?.id || null, startsAt, endsAt, 'pending', now, now);
    db.exec('COMMIT');
    return id;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};
