import { getSupabaseAdmin } from './supabase/server';

export type AvailabilityRule = { weekday: number; startTime: string; endTime: string };
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed' | 'no_show';
export type PracticeBooking = { id: string; practitionerId: string; patientId: string | null; clientName: string; clientEmail: string; startsAt: string; endsAt: string; status: BookingStatus; calendarBookedAt: string | null; createdAt: string; updatedAt: string };
export type BookableSlot = { practitionerId: string; practitionerSlug: string; startsAt: string; endsAt: string; dateLabel: string; timeLabel: string };
export type AvailabilityException = { id: string; practitionerId: string; startsAt: string; endsAt: string; kind: 'available' | 'unavailable'; privateReason: string | null; createdAt: string };
export type PractitionerProfile = {
  id: string; slug: string; name: string; email: string; active: boolean; publicRole: string; bio: string;
  expertise: string[]; languages: string[]; appointmentDurationMinutes: number; minimumNoticeHours: number;
  bookingHorizonDays: number; requestsEnabled: boolean; profileUpdatedAt: string | null;
};

type Row = Record<string, unknown>;
const TIME_ZONE = 'Europe/Brussels';
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legacyPractitionerSlugs: Record<string, string> = { prac_virginie: 'virginie', prac_margot: 'margot', prac_amy: 'amy' };
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Supabase query failed.'); };
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const format = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('nl-BE', { timeZone: TIME_ZONE, ...options }).format(new Date(value));

const settingsOf = (row: Row) => {
  const nested = row.practitioner_settings;
  return (Array.isArray(nested) ? nested[0] : nested || {}) as Row;
};
const profileFromRow = (row: Row): PractitionerProfile => {
  const settings = settingsOf(row);
  return {
    id: String(row.id), slug: String(row.slug), name: String(row.name), email: '', active: Boolean(row.active),
    publicRole: String(row.public_role || ''), bio: String(row.bio || ''), expertise: list(row.expertise), languages: list(row.languages),
    appointmentDurationMinutes: Number(settings.appointment_duration_minutes ?? 60), minimumNoticeHours: Number(settings.minimum_notice_hours ?? 2),
    bookingHorizonDays: Number(settings.booking_horizon_days ?? 30), requestsEnabled: Boolean(settings.requests_enabled ?? true),
    profileUpdatedAt: row.updated_at ? String(row.updated_at) : null,
  };
};
const bookingFromRow = (row: Row): PracticeBooking => ({
  id: String(row.id), practitionerId: String(row.practitioner_id), patientId: row.patient_id ? String(row.patient_id) : null, clientName: String(row.client_name), clientEmail: String(row.client_email),
  startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status) as BookingStatus,
  calendarBookedAt: row.calendar_booked_at ? String(row.calendar_booked_at) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

// Local IDs exist only in legacy signed sessions. Resolve them to the durable remote
// identity before every data operation, so no booking or availability data returns to SQLite.
const resolvePractitioner = async (idOrSlug: string): Promise<PractitionerProfile | null> => {
  const slug = legacyPractitionerSlugs[idOrSlug] || (!uuidPattern.test(idOrSlug) ? idOrSlug : '');
  const query = getSupabaseAdmin().from('practitioners').select('id,slug,name,active,public_role,bio,expertise,languages,updated_at,practitioner_settings(appointment_duration_minutes,minimum_notice_hours,booking_horizon_days,requests_enabled)');
  const { data, error } = slug ? await query.eq('slug', slug).maybeSingle() : await query.eq('id', idOrSlug).maybeSingle();
  fail(error);
  return data ? profileFromRow(data as Row) : null;
};

export const getPractitionerBySlug = (slug: string) => resolvePractitioner(slug.trim().toLowerCase());
export const getPractitionerProfile = (idOrSlug: string) => resolvePractitioner(idOrSlug);

export const getAvailabilityRules = async (idOrSlug: string): Promise<AvailabilityRule[]> => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner) return [];
  const { data, error } = await getSupabaseAdmin().from('availability_rules').select('weekday,start_time,end_time').eq('practitioner_id', practitioner.id).order('weekday').order('start_time');
  fail(error);
  return ((data || []) as Row[]).map((row) => ({ weekday: Number(row.weekday), startTime: String(row.start_time), endTime: String(row.end_time) }));
};

export const getBookableSlots = async (idOrSlug: string, days = 14): Promise<BookableSlot[]> => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner?.active || !practitioner.requestsEnabled) return [];
  const visibleDays = Math.min(Math.max(days, 1), practitioner.bookingHorizonDays);
  const { data, error } = await getSupabaseAdmin().rpc('get_bookable_slots', { p_practitioner_slug: practitioner.slug, p_days: visibleDays });
  fail(error);
  return ((data || []) as Row[]).map((row) => {
    const startsAt = String(row.starts_at); const endsAt = String(row.ends_at);
    return { practitionerId: practitioner.id, practitionerSlug: practitioner.slug, startsAt, endsAt, dateLabel: format(startsAt, { weekday: 'short', day: 'numeric', month: 'short' }), timeLabel: format(startsAt, { hour: '2-digit', minute: '2-digit' }) };
  });
};

export const saveAvailabilityRules = async (idOrSlug: string, actorUserId: string, rules: AvailabilityRule[]) => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner) throw new Error('not_found');
  const normalized = rules.filter((rule) => Number.isInteger(rule.weekday) && rule.weekday >= 1 && rule.weekday <= 7 && timePattern.test(rule.startTime) && timePattern.test(rule.endTime) && rule.startTime < rule.endTime);
  if (normalized.length !== rules.length) throw new Error('invalid_availability');
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const periods = normalized.filter((rule) => rule.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (periods.length > 4 || periods.some((period, index) => index > 0 && period.startTime < periods[index - 1].endTime)) throw new Error('invalid_availability');
  }
  const client = getSupabaseAdmin();
  const { error: replaceError } = await client.rpc('replace_availability_rules', { p_practitioner_id: practitioner.id, p_rules: normalized.map((rule) => ({ weekday: rule.weekday, start_time: rule.startTime, end_time: rule.endTime })) });
  fail(replaceError);
  const { error: auditError } = await client.from('security_audit_log').insert({ actor_user_id: uuidPattern.test(actorUserId) ? actorUserId : null, action: 'availability.updated', object_type: 'practitioner', object_id: practitioner.id, metadata: { rules: normalized } });
  fail(auditError);
};

export const listAvailabilityExceptions = async (idOrSlug: string): Promise<AvailabilityException[]> => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner) return [];
  const { data, error } = await getSupabaseAdmin().from('availability_exceptions').select('id,practitioner_id,starts_at,ends_at,kind,private_reason,created_at').eq('practitioner_id', practitioner.id).gte('ends_at', new Date().toISOString()).order('starts_at').limit(50);
  fail(error);
  return ((data || []) as Row[]).map((row) => ({ id: String(row.id), practitionerId: String(row.practitioner_id), startsAt: String(row.starts_at), endsAt: String(row.ends_at), kind: String(row.kind) as AvailabilityException['kind'], privateReason: row.private_reason ? String(row.private_reason) : null, createdAt: String(row.created_at) }));
};

export const createAvailabilityException = async (idOrSlug: string, actorUserId: string, startsAt: string, endsAt: string, privateReason: string) => {
  const practitioner = await resolvePractitioner(idOrSlug);
  const start = new Date(startsAt); const end = new Date(endsAt);
  if (!practitioner) throw new Error('not_found');
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 366 * 86400000) throw new Error('invalid_exception');
  const { data, error } = await getSupabaseAdmin().from('availability_exceptions').insert({ practitioner_id: practitioner.id, starts_at: start.toISOString(), ends_at: end.toISOString(), kind: 'unavailable', private_reason: privateReason.trim().slice(0, 80) || null }).select('id,practitioner_id,starts_at,ends_at,kind,private_reason,created_at').single();
  fail(error);
  if (!data) throw new Error('Availability exception could not be created.');
  await getSupabaseAdmin().from('security_audit_log').insert({ actor_user_id: uuidPattern.test(actorUserId) ? actorUserId : null, action: 'availability.exception_created', object_type: 'availability_exception', object_id: String(data.id), metadata: { practitionerId: practitioner.id } });
  return { id: String(data.id), practitionerId: String(data.practitioner_id), startsAt: String(data.starts_at), endsAt: String(data.ends_at), kind: String(data.kind) as AvailabilityException['kind'], privateReason: data.private_reason ? String(data.private_reason) : null, createdAt: String(data.created_at) };
};

export const deleteAvailabilityException = async (id: string, idOrSlug: string, actorUserId: string) => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner) throw new Error('not_found');
  const { data, error } = await getSupabaseAdmin().from('availability_exceptions').delete().eq('id', id).eq('practitioner_id', practitioner.id).select('id').maybeSingle();
  fail(error);
  if (!data) throw new Error('not_found');
  await getSupabaseAdmin().from('security_audit_log').insert({ actor_user_id: uuidPattern.test(actorUserId) ? actorUserId : null, action: 'availability.exception_deleted', object_type: 'availability_exception', object_id: id, metadata: { practitionerId: practitioner.id } });
};

export const listBookings = async (idOrSlug: string, status?: BookingStatus): Promise<PracticeBooking[]> => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner) return [];
  let query = getSupabaseAdmin().from('bookings').select('id,practitioner_id,patient_id,client_name,client_email,starts_at,ends_at,status,calendar_booked_at,created_at,updated_at').eq('practitioner_id', practitioner.id).order('starts_at');
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  fail(error);
  return ((data || []) as Row[]).map(bookingFromRow);
};

export const updateBookingStatus = async (bookingId: string, idOrSlug: string, actorUserId: string, nextStatus: BookingStatus, requestId?: string, requestPath?: string) => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner) throw new Error('not_found');
  const { error } = await getSupabaseAdmin().rpc('transition_booking_status', {
    p_booking_id: bookingId,
    p_actor_user_id: actorUserId,
    p_next_status: nextStatus,
    p_request_id: requestId || null,
    p_request_path: requestPath || null,
  });
  if (error?.code === 'P0002') throw new Error('not_found');
  if (error?.code === '42501') throw new Error('not_allowed');
  if (error?.code === '22023') throw new Error('invalid_transition');
  fail(error);
};

export const createBookingRequest = async (slug: string, customerUserId: string, startsAt: string, endsAt: string, submissionKey: string, requestId?: string) => {
  const practitioner = await getPractitionerBySlug(slug);
  if (!practitioner) throw new Error('slot_unavailable');
  const { data, error } = await getSupabaseAdmin().rpc('request_customer_booking', {
    p_practitioner_slug: practitioner.slug,
    p_customer_user_id: customerUserId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_submission_key: submissionKey,
    p_request_id: requestId || null,
  });
  if (error?.code === 'P0001' || error?.code === '23P01') throw new Error('slot_unavailable');
  if (error?.code === '42501') throw new Error('customer_required');
  if (error?.code === '28000') throw new Error('email_confirmation');
  if (error?.code === '22023') throw new Error('invalid_input');
  if (error?.code === '23505') throw new Error('idempotency_conflict');
  fail(error);
  return String(data);
};

const parseList = (value: string, maximum: number) => Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim().replace(/\s+/g, ' ')).filter((item) => item.length >= 2 && item.length <= 60))).slice(0, maximum);
const oneOfNumber = (value: unknown, allowed: number[], fallback: number) => allowed.includes(Number(value)) ? Number(value) : fallback;
export const updatePractitionerProfile = async (idOrSlug: string, actorUserId: string, input: { name: string; publicRole: string; bio: string; expertise: string; languages: string; appointmentDurationMinutes: unknown; minimumNoticeHours: unknown; bookingHorizonDays: unknown; requestsEnabled: boolean }) => {
  const practitioner = await resolvePractitioner(idOrSlug);
  if (!practitioner) throw new Error('not_found');
  const name = input.name.trim().replace(/\s+/g, ' '); const publicRole = input.publicRole.trim().replace(/\s+/g, ' '); const bio = input.bio.trim().replace(/\s+/g, ' ');
  const expertise = parseList(input.expertise, 8); const languages = parseList(input.languages, 6);
  if (name.length < 2 || name.length > 80 || publicRole.length < 2 || publicRole.length > 100 || bio.length < 40 || bio.length > 1200 || expertise.length === 0 || languages.length === 0) throw new Error('invalid_profile');
  const duration = oneOfNumber(input.appointmentDurationMinutes, [45, 60, 75, 90], 60);
  const notice = oneOfNumber(input.minimumNoticeHours, [0, 1, 2, 4, 12, 24, 48, 72], 2);
  const horizon = oneOfNumber(input.bookingHorizonDays, [14, 30, 45, 60, 90], 30);
  const client = getSupabaseAdmin();
  const { error: profileError } = await client.from('practitioners').update({ name, public_role: publicRole, bio, expertise, languages }).eq('id', practitioner.id);
  fail(profileError);
  const { error: settingsError } = await client.from('practitioner_settings').upsert({ practitioner_id: practitioner.id, appointment_duration_minutes: duration, minimum_notice_hours: notice, booking_horizon_days: horizon, requests_enabled: input.requestsEnabled });
  fail(settingsError);
  const { error: auditError } = await client.from('security_audit_log').insert({ actor_user_id: uuidPattern.test(actorUserId) ? actorUserId : null, action: 'profile.updated', object_type: 'practitioner', object_id: practitioner.id, metadata: { duration, notice, horizon, requestsEnabled: input.requestsEnabled } });
  fail(auditError);
  return getPractitionerProfile(practitioner.id);
};

export const getPracticeSummary = async (idOrSlug: string) => {
  const [bookings, rules, nextSlots] = await Promise.all([listBookings(idOrSlug), getAvailabilityRules(idOrSlug), getBookableSlots(idOrSlug, 14)]);
  const now = new Date().toISOString();
  return { pending: bookings.filter((booking) => booking.status === 'pending').length, upcoming: bookings.filter((booking) => booking.status === 'confirmed' && booking.startsAt >= now).length, availabilityDays: new Set(rules.map((rule) => rule.weekday)).size, nextSlots: nextSlots.slice(0, 4) };
};
