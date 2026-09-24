import { getSupabaseAdmin } from './supabase/server';
import { writeSecurityAudit, type AuditActor } from './securityAudit';

type Row = Record<string, any>;
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Supabase query failed.'); };
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const categories = ['payment', 'delivery', 'booking', 'content', 'support', 'privacy', 'system'];

export const listAdminTaskAssignees = async () => {
  const client = getSupabaseAdmin();
  const { data: roles, error: rolesError } = await client.from('user_roles').select('user_id,role').in('role', ['super_admin', 'support', 'employee']);
  fail(rolesError);
  const ids = [...new Set(((roles || []) as Row[]).map((row) => String(row.user_id)))];
  if (!ids.length) return [];
  const { data: profiles, error } = await client.from('profiles').select('id,full_name').in('id', ids).order('full_name');
  fail(error);
  return ((profiles || []) as Row[]).map((row) => ({ id: String(row.id), name: String(row.full_name || 'Naam niet ingevuld') }));
};

export const createAdminTask = async (input: {
  title: string; category: string; priority: number; dueOn: string; assignedTo: string;
}, actor: AuditActor) => {
  const title = input.title.trim().replace(/\s+/g, ' ');
  if (title.length < 3 || title.length > 240 || !categories.includes(input.category)
    || !Number.isInteger(input.priority) || input.priority < 1 || input.priority > 4) throw new Error('invalid_input');
  let dueAt: string | null = null;
  if (input.dueOn) {
    const due = new Date(`${input.dueOn}T12:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || Number.isNaN(due.getTime()) || due.toISOString().slice(0, 10) !== input.dueOn) throw new Error('invalid_input');
    dueAt = due.toISOString();
  }
  if (input.assignedTo && !uuid(input.assignedTo)) throw new Error('invalid_input');
  const client = getSupabaseAdmin();
  if (input.assignedTo) {
    const { data, error } = await client.from('user_roles').select('user_id').eq('user_id', input.assignedTo).in('role', ['super_admin', 'support', 'employee']).limit(1);
    fail(error);
    if (!data?.length) throw new Error('invalid_assignee');
  }
  const { data, error } = await client.from('admin_work_items').insert({
    title, category: input.category, priority: input.priority, status: 'open', due_at: dueAt,
    assigned_to: input.assignedTo || null, created_by: actor.userId,
  }).select('id,title,category,priority,status,due_at,assigned_to').single();
  fail(error);
  const row = data as Row;
  await writeSecurityAudit({
    actor, action: 'admin_work_item.created', objectType: 'admin_work_item', objectId: String(row.id),
    after: { title: row.title, category: row.category, priority: row.priority, status: row.status, due_at: row.due_at, assigned_to: row.assigned_to },
  });
  return String(row.id);
};
