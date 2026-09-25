import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';
import type { UserSession } from './adminAuth';

type Row = Record<string, any>;
type PatientStatus = 'active' | 'archived';
type NoteStatus = 'draft' | 'final';
type NoteType = 'intake' | 'session' | 'follow_up' | 'other' | 'correction';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noteTypes: NoteType[] = ['intake', 'session', 'follow_up', 'other', 'correction'];
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'client_records_error'); };
const canUseRecords = (user: UserSession) => user.roles.some((role) => ['super_admin', 'employee', 'practitioner'].includes(role));
const isOwner = (user: UserSession) => user.roles.includes('super_admin');
const normalizeName = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const normalizeEmail = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
const parseBrusselsDateTime = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return new Date(Number.NaN);
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(candidate);
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
    const rendered = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
    const difference = target - rendered;
    if (!difference) break;
    candidate = new Date(candidate.getTime() + difference);
  }
  const verify = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(candidate);
  const valueFor = (type: string) => verify.find((item) => item.type === type)?.value;
  const valid = valueFor('year') === match[1] && valueFor('month') === match[2] && valueFor('day') === match[3] && valueFor('hour') === match[4] && valueFor('minute') === match[5];
  return valid ? candidate : new Date(Number.NaN);
};
const audit = (actor: AuditActor, action: string, objectType: string, objectId: string, metadata: Record<string, unknown> = {}) =>
  writeSecurityAudit({ actor, action, objectType, objectId, metadata });

export type PatientDirectoryItem = {
  id: string;
  fullName: string;
  email: string | null;
  customerUserId: string | null;
  status: PatientStatus;
  createdAt: string;
  updatedAt: string;
  activeAssignments: string[];
  latestNoteAt: string | null;
  noteCount: number;
  nextAppointmentAt: string | null;
};

export type PatientBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  practitionerName: string;
};

export type PatientNoteVersion = {
  versionNumber: number;
  title: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
};

export type PatientNote = {
  id: string;
  bookingId: string | null;
  type: NoteType;
  occurredAt: string;
  status: NoteStatus;
  currentVersion: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  correctsNoteId: string | null;
  correctsNoteTitle: string | null;
  current: PatientNoteVersion;
  versions: PatientNoteVersion[];
};

export type PatientAssignment = {
  id: string;
  userId: string;
  name: string;
  assignedAt: string;
  endedAt: string | null;
};

export type PatientDetail = {
  id: string;
  fullName: string;
  email: string | null;
  customerUserId: string | null;
  status: PatientStatus;
  createdAt: string;
  updatedAt: string;
  canManageAssignments: boolean;
  canArchive: boolean;
  assignments: PatientAssignment[];
  notes: PatientNote[];
  bookings: PatientBooking[];
  noteCount: number;
  notePage: number;
  notePageCount: number;
  bookingCount: number;
  linkableBookings: PatientBooking[];
  linkedCustomer: { id: string; fullName: string } | null;
};

export type PatientStaffMember = { id: string; name: string; roles: string[] };
export type PatientSourceBooking = { id: string; patientId: string | null; customerUserId: string | null; clientName: string; clientEmail: string; startsAt: string; status: string; practitionerName: string };
export type PatientReference = { id: string; fullName: string; status: PatientStatus };
export type CustomerAccountCandidate = { id: string; fullName: string; email: string | null };

const assertRecordRole = (user: UserSession) => {
  if (!canUseRecords(user)) throw new Error('not_allowed');
};

export const auditPatientDirectoryAccess = async (user: UserSession, requestId?: string) => {
  assertRecordRole(user);
  await audit({ userId: user.sub, email: user.email, requestId, requestPath: '/admin/clienten' }, 'patient.directory_viewed', 'patient_directory', user.sub, { scope: isOwner(user) ? 'all' : 'assigned' });
};

const hasPatientAccess = async (user: UserSession, patientId: string) => {
  if (isOwner(user)) return true;
  if (!canUseRecords(user)) return false;
  const { data, error } = await getSupabaseAdmin().from('patient_assignments').select('id').eq('patient_id', patientId).eq('user_id', user.sub).is('ended_at', null).maybeSingle();
  fail(error);
  return Boolean(data);
};

export const getPatientReference = async (user: UserSession, patientId: string, requestId?: string): Promise<PatientReference | null> => {
  assertRecordRole(user);
  if (!uuidPattern.test(patientId) || !(await hasPatientAccess(user, patientId))) return null;
  const { data, error } = await getSupabaseAdmin().from('patients').select('id,full_name,status').eq('id', patientId).maybeSingle();
  fail(error);
  if (!data) return null;
  await audit({ userId: user.sub, email: user.email, requestId, requestPath: '/admin/clienten' }, 'patient.reference_viewed', 'patient', patientId, { status: String(data.status) });
  return { id: String(data.id), fullName: String(data.full_name), status: String(data.status) as PatientStatus };
};

export const getPatientForCustomerAccount = async (user: UserSession, customerUserId: string): Promise<PatientReference | null> => {
  if (!isOwner(user) || !uuidPattern.test(customerUserId)) return null;
  const { data, error } = await getSupabaseAdmin().from('patients').select('id,full_name,status').eq('customer_user_id', customerUserId).maybeSingle();
  fail(error);
  return data ? { id: String(data.id), fullName: String(data.full_name), status: String(data.status) as PatientStatus } : null;
};

export const listUnlinkedCustomerAccounts = async (user: UserSession, search = ''): Promise<CustomerAccountCandidate[]> => {
  if (!isOwner(user)) return [];
  const term = search.trim().slice(0, 80);
  const collect = async (field?: 'full_name' | 'email') => {
    let query = getSupabaseAdmin().from('patient_customer_candidates').select('id,full_name,email').order('full_name').limit(100);
    if (term && field) query = query.ilike(field, `%${term}%`);
    const { data, error } = await query;
    fail(error);
    return (data || []) as Row[];
  };
  const rows = term
    ? [...new Map((await Promise.all([collect('full_name'), collect('email')])).flat().map((row) => [String(row.id), row])).values()]
    : await collect();
  return rows.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'nl')).map((row) => ({
    id: String(row.id), fullName: String(row.full_name || 'Naam ontbreekt'), email: row.email ? String(row.email) : null,
  }));
};

const assertPatientAccess = async (user: UserSession, patientId: string) => {
  if (!uuidPattern.test(patientId) || !(await hasPatientAccess(user, patientId))) throw new Error('not_found');
};

const accessiblePatientIds = async (user: UserSession) => {
  if (isOwner(user)) return null;
  if (!canUseRecords(user)) throw new Error('not_allowed');
  const { data, error } = await getSupabaseAdmin().from('patient_assignments').select('patient_id').eq('user_id', user.sub).is('ended_at', null);
  fail(error);
  return [...new Set(((data || []) as Row[]).map((row) => String(row.patient_id)))];
};

const queryPatients = async (ids: string[] | null, status: PatientStatus | 'all', term: string) => {
  const client = getSupabaseAdmin();
  const collect = async (field?: 'full_name' | 'email') => {
    let query = client.from('patients').select('id,full_name,email,customer_user_id,status,created_at,updated_at').order('updated_at', { ascending: false }).limit(500);
    if (ids) {
      if (!ids.length) return [] as Row[];
      query = query.in('id', ids);
    }
    if (status !== 'all') query = query.eq('status', status);
    if (term && field) query = query.ilike(field, `%${term}%`);
    const { data, error } = await query;
    fail(error);
    return (data || []) as Row[];
  };
  if (!term) return collect();
  const [names, emails] = await Promise.all([collect('full_name'), collect('email')]);
  return [...new Map([...names, ...emails].map((row) => [String(row.id), row])).values()]
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
};

export const listPatientRecords = async (user: UserSession, search = '', status: PatientStatus | 'all' = 'active'): Promise<PatientDirectoryItem[]> => {
  assertRecordRole(user);
  const ids = await accessiblePatientIds(user);
  const term = normalizeName(search).slice(0, 80);
  const rows = await queryPatients(ids, status, term);
  if (!rows.length) return [];
  const patientIds = rows.map((row) => String(row.id));
  const client = getSupabaseAdmin();
  const [assignmentsResult, notesResult, bookingsResult] = await Promise.all([
    client.from('patient_assignments').select('patient_id,user_id,ended_at').in('patient_id', patientIds).is('ended_at', null),
    client.from('patient_note_statistics').select('patient_id,note_count,latest_note_at').in('patient_id', patientIds),
    client.from('bookings').select('patient_id,starts_at,status').in('patient_id', patientIds).in('status', ['confirmed', 'pending']).gte('starts_at', new Date().toISOString()).order('starts_at').limit(1000),
  ]);
  fail(assignmentsResult.error); fail(notesResult.error); fail(bookingsResult.error);
  const assignments = ((assignmentsResult.data || []) as Row[]).map((row) => ({ patientId: String(row.patient_id), userId: String(row.user_id) }));
  const staffIds = [...new Set(assignments.map((item) => item.userId))];
  const { data: profiles, error: profileError } = staffIds.length
    ? await client.from('profiles').select('id,full_name').in('id', staffIds)
    : { data: [], error: null };
  fail(profileError);
  const profileNames = new Map(((profiles || []) as Row[]).map((row) => [String(row.id), String(row.full_name || 'Medewerker')]));
  const assignmentNames = new Map<string, string[]>();
  assignments.forEach(({ patientId, userId }) => assignmentNames.set(patientId, [...(assignmentNames.get(patientId) || []), profileNames.get(userId) || 'Medewerker']));
  const noteMeta = new Map<string, { latestAt: string | null; count: number }>();
  ((notesResult.data || []) as Row[]).forEach((row) => noteMeta.set(String(row.patient_id), { latestAt: row.latest_note_at ? String(row.latest_note_at) : null, count: Number(row.note_count) }));
  const nextAppointments = new Map<string, string>();
  ((bookingsResult.data || []) as Row[]).forEach((row) => { if (!nextAppointments.has(String(row.patient_id))) nextAppointments.set(String(row.patient_id), String(row.starts_at)); });
  return rows.map((row) => {
    const id = String(row.id); const note = noteMeta.get(id);
    return { id, fullName: String(row.full_name), email: row.email ? String(row.email) : null, customerUserId: row.customer_user_id ? String(row.customer_user_id) : null, status: String(row.status) as PatientStatus,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), activeAssignments: assignmentNames.get(id) || [],
      latestNoteAt: note?.latestAt || null, noteCount: note?.count || 0, nextAppointmentAt: nextAppointments.get(id) || null };
  });
};

const loadAssignments = async (patientId: string, showHistory: boolean): Promise<PatientAssignment[]> => {
  let query = getSupabaseAdmin().from('patient_assignments').select('id,user_id,assigned_at,ended_at').eq('patient_id', patientId).order('assigned_at', { ascending: false });
  if (!showHistory) query = query.is('ended_at', null);
  const { data, error } = await query;
  fail(error);
  const rows = (data || []) as Row[]; const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
  const { data: profiles, error: profileError } = userIds.length ? await getSupabaseAdmin().from('profiles').select('id,full_name').in('id', userIds) : { data: [], error: null };
  fail(profileError);
  const names = new Map(((profiles || []) as Row[]).map((row) => [String(row.id), String(row.full_name || 'Medewerker')]));
  return rows.map((row) => ({ id: String(row.id), userId: String(row.user_id), name: names.get(String(row.user_id)) || 'Medewerker', assignedAt: String(row.assigned_at), endedAt: row.ended_at ? String(row.ended_at) : null }));
};

export const getPatientDetail = async (user: UserSession, patientId: string, historyNoteId = '', requestId?: string, requestedNotePage = 1): Promise<PatientDetail | null> => {
  assertRecordRole(user);
  if (!uuidPattern.test(patientId) || !(await hasPatientAccess(user, patientId))) return null;
  const client = getSupabaseAdmin();
  const { data: patient, error: patientError } = await client.from('patients').select('id,full_name,email,customer_user_id,status,created_at,updated_at').eq('id', patientId).maybeSingle();
  fail(patientError);
  if (!patient) return null;
  const { count: noteCount, error: noteCountError } = await client.from('patient_notes').select('id', { count: 'exact', head: true }).eq('patient_id', patientId);
  fail(noteCountError);
  const totalNoteCount = noteCount || 0;
  const notePageCount = Math.max(1, Math.ceil(totalNoteCount / 50));
  const notePage = Math.min(notePageCount, Math.max(1, Number.isInteger(requestedNotePage) ? requestedNotePage : 1));
  const [{ data: noteRows, error: noteError }, { data: bookingRows, error: bookingError }, assignments, bookingCountResult] = await Promise.all([
    client.from('patient_notes_current').select('id,booking_id,note_type,occurred_at,status,current_version,created_by,created_at,updated_at,finalized_at,corrects_note_id,title,body,version_created_at').eq('patient_id', patientId).order('occurred_at', { ascending: false }).order('created_at', { ascending: false }).range((notePage - 1) * 50, notePage * 50 - 1),
    client.from('bookings').select('id,starts_at,ends_at,status,practitioners(name)').eq('patient_id', patientId).order('starts_at', { ascending: false }).limit(100),
    loadAssignments(patientId, isOwner(user)),
    client.from('bookings').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
  ]);
  fail(noteError); fail(bookingError); fail(bookingCountResult.error);
  const rawNotes = (noteRows || []) as Row[];
  const noteIds = rawNotes.map((row) => String(row.id));
  let versionRows: Row[] = [];
  if (historyNoteId && noteIds.includes(historyNoteId)) {
    const { data, error } = await client.from('patient_note_versions').select('note_id,version_number,title,body,created_by,created_at').eq('note_id', historyNoteId).order('version_number', { ascending: false }).limit(50);
    fail(error); versionRows = (data || []) as Row[];
  }
  const correctedNoteIds = [...new Set(rawNotes.map((row) => row.corrects_note_id ? String(row.corrects_note_id) : '').filter(Boolean))];
  let correctedNoteTitles = new Map<string, string>();
  if (correctedNoteIds.length) {
    const { data, error } = await client.from('patient_notes_current').select('id,title').eq('patient_id', patientId).in('id', correctedNoteIds);
    fail(error);
    correctedNoteTitles = new Map(((data || []) as Row[]).map((row) => [String(row.id), String(row.title)]));
  }
  const versionHistory = new Map<string, PatientNoteVersion[]>();
  versionRows.forEach((row) => versionHistory.set(String(row.note_id), [...(versionHistory.get(String(row.note_id)) || []), {
    versionNumber: Number(row.version_number), title: String(row.title), body: String(row.body), createdBy: row.created_by ? String(row.created_by) : null, createdAt: String(row.created_at),
  }]));
  const notes: PatientNote[] = rawNotes.map((row) => ({
    id: String(row.id), bookingId: row.booking_id ? String(row.booking_id) : null, type: String(row.note_type) as NoteType,
    occurredAt: String(row.occurred_at), status: String(row.status) as NoteStatus, currentVersion: Number(row.current_version),
    createdBy: row.created_by ? String(row.created_by) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    finalizedAt: row.finalized_at ? String(row.finalized_at) : null, correctsNoteId: row.corrects_note_id ? String(row.corrects_note_id) : null,
    correctsNoteTitle: row.corrects_note_id ? correctedNoteTitles.get(String(row.corrects_note_id)) || null : null,
    current: { versionNumber: Number(row.current_version), title: String(row.title), body: String(row.body), createdBy: row.created_by ? String(row.created_by) : null, createdAt: String(row.version_created_at) },
    versions: versionHistory.get(String(row.id)) || [],
  }));
  const bookings: PatientBooking[] = ((bookingRows || []) as Row[]).map((row) => ({ id: String(row.id), startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status), practitionerName: String(row.practitioners?.name || 'Professional') }));
  let linkableBookings: PatientBooking[] = [];
  const practitionerId = user.practitionerId;
  if (patient.status === 'active' && (isOwner(user) || practitionerId)) {
    let query = client.from('bookings').select('id,customer_user_id,starts_at,ends_at,status,practitioners(name)').is('patient_id', null).in('status', ['confirmed', 'completed', 'no_show']).order('starts_at', { ascending: false }).limit(100);
    if (!isOwner(user)) query = query.eq('practitioner_id', practitionerId);
    if (patient.customer_user_id) query = query.eq('customer_user_id', patient.customer_user_id);
    else if (patient.email) query = query.eq('client_email', patient.email);
    else query = query.is('customer_user_id', null).eq('client_name', patient.full_name);
    const result = await query; fail(result.error);
    linkableBookings = ((result.data || []) as Row[]).map((row) => ({ id: String(row.id), startsAt: String(row.starts_at), endsAt: String(row.ends_at), status: String(row.status), practitionerName: String(row.practitioners?.name || 'Professional') }));
  }
  let linkedCustomer: PatientDetail['linkedCustomer'] = null;
  if (patient.customer_user_id) {
    const { data, error } = await client.from('profiles').select('id,full_name').eq('id', patient.customer_user_id).maybeSingle();
    fail(error); if (data) linkedCustomer = { id: String(data.id), fullName: String(data.full_name || 'Klantaccount') };
  }
  await audit({ userId: user.sub, email: user.email, requestId, requestPath: `/admin/clienten/${patientId}` }, 'patient.dossier_viewed', 'patient', patientId, { status: String(patient.status) });
  return {
    id: String(patient.id), fullName: String(patient.full_name), email: patient.email ? String(patient.email) : null,
    customerUserId: patient.customer_user_id ? String(patient.customer_user_id) : null, status: String(patient.status) as PatientStatus,
    createdAt: String(patient.created_at), updatedAt: String(patient.updated_at), canManageAssignments: isOwner(user), canArchive: isOwner(user),
    assignments, notes, bookings, noteCount: totalNoteCount, notePage, notePageCount, bookingCount: bookingCountResult.count || 0, linkableBookings, linkedCustomer,
  };
};

export const getPatientStaff = async (): Promise<PatientStaffMember[]> => {
  const { data: roles, error: roleError } = await getSupabaseAdmin().from('user_roles').select('user_id,role').in('role', ['super_admin', 'employee', 'practitioner']);
  fail(roleError);
  const roleMap = new Map<string, string[]>();
  ((roles || []) as Row[]).forEach((row) => roleMap.set(String(row.user_id), [...(roleMap.get(String(row.user_id)) || []), String(row.role)]));
  const ids = [...roleMap.keys()]; if (!ids.length) return [];
  const { data: profiles, error } = await getSupabaseAdmin().from('profiles').select('id,full_name').in('id', ids).order('full_name');
  fail(error);
  return ((profiles || []) as Row[]).map((row) => ({ id: String(row.id), name: String(row.full_name || 'Medewerker'), roles: roleMap.get(String(row.id)) || [] }));
};

export const getBookingForPatientCreation = async (user: UserSession, bookingId: string): Promise<PatientSourceBooking | null> => {
  assertRecordRole(user);
  if (!uuidPattern.test(bookingId)) return null;
  let query = getSupabaseAdmin().from('bookings').select('id,patient_id,customer_user_id,client_name,client_email,starts_at,status,practitioner_id,practitioners(name)').eq('id', bookingId);
  if (!isOwner(user)) {
    if (!user.practitionerId) return null;
    query = query.eq('practitioner_id', user.practitionerId);
  }
  const { data, error } = await query.maybeSingle();
  fail(error);
  if (!data || !['confirmed', 'completed', 'no_show'].includes(String(data.status))) return null;
  return { id: String(data.id), patientId: data.patient_id ? String(data.patient_id) : null, customerUserId: data.customer_user_id ? String(data.customer_user_id) : null, clientName: String(data.client_name), clientEmail: String(data.client_email), startsAt: String(data.starts_at), status: String(data.status), practitionerName: String((data as Row).practitioners?.name || 'Professional') };
};

export const createPatient = async (input: { fullName: unknown; email: unknown; assigneeUserId: unknown }, user: UserSession, actor: AuditActor) => {
  assertRecordRole(user);
  const fullName = normalizeName(input.fullName); const email = normalizeEmail(input.email);
  if (fullName.length < 2 || fullName.length > 120 || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) throw new Error('invalid_input');
  const assignee = normalizeName(input.assigneeUserId) || null;
  if (assignee && !uuidPattern.test(assignee)) throw new Error('invalid_input');
  if (!isOwner(user) && assignee && assignee !== user.sub) throw new Error('not_allowed');
  const { data, error } = await getSupabaseAdmin().rpc('create_patient_record', { p_actor_user_id: user.sub, p_full_name: fullName, p_email: email, p_assignee_user_id: assignee, p_request_id: actor.requestId || null });
  fail(error); const id = String(data);
  return id;
};

export const createPatientFromBooking = async (bookingId: string, user: UserSession, actor: AuditActor) => {
  assertRecordRole(user);
  if (!uuidPattern.test(bookingId)) throw new Error('invalid_input');
  const { data, error } = await getSupabaseAdmin().rpc('create_patient_from_booking', { p_actor_user_id: user.sub, p_booking_id: bookingId, p_request_id: actor.requestId || null });
  fail(error); const id = String(data);
  return id;
};

export const createPatientFromCustomerAccount = async (customerUserId: string, assigneeUserId: string | null, user: UserSession, actor: AuditActor) => {
  if (!isOwner(user) || !uuidPattern.test(customerUserId) || (assigneeUserId && !uuidPattern.test(assigneeUserId))) throw new Error('not_allowed');
  const { data, error } = await getSupabaseAdmin().rpc('create_patient_from_customer', {
    p_actor_user_id: user.sub, p_customer_user_id: customerUserId, p_assignee_user_id: assigneeUserId, p_request_id: actor.requestId || null,
  });
  fail(error);
  return String(data);
};

export const linkPatientCustomerAccount = async (patientId: string, customerUserId: string, user: UserSession, actor: AuditActor) => {
  if (!isOwner(user) || !uuidPattern.test(patientId) || !uuidPattern.test(customerUserId)) throw new Error('not_allowed');
  const { error } = await getSupabaseAdmin().rpc('link_patient_customer_account', {
    p_actor_user_id: user.sub, p_patient_id: patientId, p_customer_user_id: customerUserId, p_request_id: actor.requestId || null,
  });
  fail(error);
};

export const createPatientNote = async (input: { patientId: string; bookingId: string | null; type: NoteType; occurredAt: string; title: unknown; body: unknown; status: NoteStatus; correctsNoteId: string | null }, user: UserSession, actor: AuditActor) => {
  assertRecordRole(user); await assertPatientAccess(user, input.patientId);
  const title = typeof input.title === 'string' ? input.title.trim() : ''; const body = typeof input.body === 'string' ? input.body.trim() : '';
  const occurred = parseBrusselsDateTime(input.occurredAt);
  if (!noteTypes.includes(input.type) || title.length < 2 || title.length > 120 || body.length < 1 || body.length > 20000 || !Number.isFinite(occurred.getTime()) || (input.bookingId && !uuidPattern.test(input.bookingId)) || (input.correctsNoteId && !uuidPattern.test(input.correctsNoteId)) || !['draft', 'final'].includes(input.status)) throw new Error('invalid_input');
  if (input.correctsNoteId && input.type !== 'correction') throw new Error('invalid_input');
  const { data, error } = await getSupabaseAdmin().rpc('create_patient_note', {
    p_actor_user_id: user.sub, p_patient_id: input.patientId, p_booking_id: input.bookingId, p_note_type: input.type,
    p_occurred_at: occurred.toISOString(), p_title: title, p_body: body, p_status: input.status, p_corrects_note_id: input.correctsNoteId, p_request_id: actor.requestId || null,
  });
  fail(error); const noteId = String(data);
  return noteId;
};

export const savePatientNoteVersion = async (input: { noteId: string; patientId: string; expectedVersion: number; title: unknown; body: unknown; finalize: boolean }, user: UserSession, actor: AuditActor) => {
  assertRecordRole(user);
  const title = typeof input.title === 'string' ? input.title.trim() : ''; const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!uuidPattern.test(input.noteId) || !uuidPattern.test(input.patientId) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 || title.length < 2 || title.length > 120 || body.length < 1 || body.length > 20000) throw new Error('invalid_input');
  const { data, error } = await getSupabaseAdmin().rpc('append_patient_note_version', {
    p_actor_user_id: user.sub, p_note_id: input.noteId, p_expected_version: input.expectedVersion, p_title: title, p_body: body, p_finalize: input.finalize, p_request_id: actor.requestId || null,
  });
  fail(error); const version = Number(data);
  return { patientId: input.patientId, version, status: input.finalize ? 'final' as const : 'draft' as const };
};

export const linkPatientBooking = async (patientId: string, bookingId: string, user: UserSession, actor: AuditActor) => {
  assertRecordRole(user); await assertPatientAccess(user, patientId);
  if (!uuidPattern.test(bookingId)) throw new Error('invalid_input');
  const { error } = await getSupabaseAdmin().rpc('link_patient_booking', { p_actor_user_id: user.sub, p_patient_id: patientId, p_booking_id: bookingId, p_request_id: actor.requestId || null });
  fail(error);
};

export const changePatientAssignment = async (input: { patientId: string; assigneeUserId: string; assign: boolean }, user: UserSession, actor: AuditActor) => {
  if (!isOwner(user) || !uuidPattern.test(input.patientId) || !uuidPattern.test(input.assigneeUserId)) throw new Error('not_allowed');
  const { error } = await getSupabaseAdmin().rpc('change_patient_assignment', { p_actor_user_id: user.sub, p_patient_id: input.patientId, p_assignee_user_id: input.assigneeUserId, p_assign: input.assign, p_request_id: actor.requestId || null });
  fail(error);
};

export const archivePatient = async (patientId: string, user: UserSession, actor: AuditActor, archived = true) => {
  if (!isOwner(user) || !uuidPattern.test(patientId)) throw new Error('not_allowed');
  const { error } = await getSupabaseAdmin().rpc('archive_patient_record', { p_actor_user_id: user.sub, p_patient_id: patientId, p_archive: archived, p_request_id: actor.requestId || null });
  fail(error);
};

export const getPatientByNote = async (noteId: string, user: UserSession) => {
  assertRecordRole(user);
  if (!uuidPattern.test(noteId)) return null;
  const { data, error } = await getSupabaseAdmin().from('patient_notes').select('id,patient_id,created_by,status,current_version').eq('id', noteId).maybeSingle();
  fail(error); if (!data || !(await hasPatientAccess(user, String(data.patient_id)))) return null;
  return { id: String(data.id), patientId: String(data.patient_id), createdBy: data.created_by ? String(data.created_by) : null, status: String(data.status) as NoteStatus, currentVersion: Number(data.current_version) };
};

export const noteTypeLabels: Record<NoteType, string> = { intake: 'Intake', session: 'Sessieverslag', follow_up: 'Opvolging', other: 'Overig', correction: 'Aanvulling/correctie' };
