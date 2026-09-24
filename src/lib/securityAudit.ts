import { getSupabaseAdmin } from './supabase/server';

export type AuditActor = {
  userId: string;
  email: string;
  requestId?: string;
  requestPath?: string;
};

export const auditActor = (user: { sub: string; email: string } | undefined, requestId?: string, requestPath?: string): AuditActor => ({
  userId: user?.sub || '',
  email: user?.email || 'unknown',
  requestId,
  requestPath,
});

export const writeSecurityAudit = async ({
  actor, action, objectType, objectId, metadata = {}, before, after,
}: {
  actor: AuditActor;
  action: string;
  objectType: string;
  objectId: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) => {
  const { error } = await getSupabaseAdmin().from('security_audit_log').insert({
    actor_user_id: /^[0-9a-f-]{36}$/i.test(actor.userId) ? actor.userId : null,
    action,
    object_type: objectType,
    object_id: objectId,
    request_id: actor.requestId || null,
    request_path: actor.requestPath || null,
    before_snapshot: before || null,
    after_snapshot: after || null,
    metadata: { ...metadata, actor_email: actor.email },
  });
  if (error) throw new Error(error.message || 'Audit logging failed.');
};
