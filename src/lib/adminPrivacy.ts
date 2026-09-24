import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

export const REQUEST_TYPES = ['access', 'correction', 'erasure', 'portability', 'objection'] as const;
export const REQUEST_STATUSES = ['received', 'in_progress', 'resolved', 'rejected'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type PrivacyRequest = { id: string; customerUserId: string | null; type: RequestType; status: RequestStatus; receivedAt: string; dueAt: string; resolvedAt: string | null };

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'database_error'); };
const row = (value: Record<string, unknown>): PrivacyRequest => ({ id: String(value.id), customerUserId: value.customer_user_id ? String(value.customer_user_id) : null, type: value.request_type as RequestType, status: value.status as RequestStatus, receivedAt: String(value.received_at), dueAt: String(value.due_at), resolvedAt: value.resolved_at ? String(value.resolved_at) : null });

export const createPrivacyRequest = async (input: { customerUserId: string; type: RequestType }, actor: AuditActor) => {
  if (!uuid(input.customerUserId) || !REQUEST_TYPES.includes(input.type)) throw new Error('invalid_input');
  const { data, error } = await getSupabaseAdmin().from('data_subject_requests').insert({ customer_user_id: input.customerUserId, request_type: input.type, handled_by: actor.userId || null }).select('id,customer_user_id,request_type,status,received_at,due_at,resolved_at').single();
  fail(error); const request = row(data as Record<string, unknown>);
  await writeSecurityAudit({ actor, action: 'privacy.request_created', objectType: 'data_subject_request', objectId: request.id, after: { type: request.type, due_at: request.dueAt, customer_user_id: request.customerUserId } });
  return request;
};

export const updatePrivacyRequestStatus = async (id: string, status: RequestStatus, actor: AuditActor) => {
  if (!uuid(id) || !REQUEST_STATUSES.includes(status)) throw new Error('invalid_input');
  const client = getSupabaseAdmin();
  const { data: beforeData, error: beforeError } = await client.from('data_subject_requests').select('id,customer_user_id,request_type,status,received_at,due_at,resolved_at').eq('id', id).maybeSingle();
  fail(beforeError); if (!beforeData) throw new Error('not_found');
  const { data, error } = await client.from('data_subject_requests').update({ status, handled_by: actor.userId || null, resolved_at: ['resolved', 'rejected'].includes(status) ? new Date().toISOString() : null }).eq('id', id).select('id,customer_user_id,request_type,status,received_at,due_at,resolved_at').single();
  fail(error); const request = row(data as Record<string, unknown>);
  await writeSecurityAudit({ actor, action: 'privacy.request_status_changed', objectType: 'data_subject_request', objectId: id, before: { status: beforeData.status, resolved_at: beforeData.resolved_at }, after: { status: request.status, resolved_at: request.resolvedAt } });
  return request;
};
