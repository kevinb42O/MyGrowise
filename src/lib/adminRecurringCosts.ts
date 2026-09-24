import { getSupabaseAdmin } from './supabase/server';
import type { AuditActor } from './securityAudit';

type Row = Record<string, any>;

export type AdminRecurringCostPayment = {
  id: string;
  amountCents: number;
  currency: string;
  paidAt: string;
  nextDueOn: string;
  note: string;
};

export type AdminRecurringCost = {
  id: string;
  label: string;
  amountCents: number;
  currency: string;
  intervalMonths: number;
  nextDueOn: string;
  lastPaidAt: string | null;
  payments: AdminRecurringCostPayment[];
};

const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Supabase query failed.'); };
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const mapCost = (row: Row, payments: AdminRecurringCostPayment[] = []): AdminRecurringCost => ({
  id: String(row.id), label: String(row.label), amountCents: Number(row.amount_cents), currency: String(row.currency).trim(),
  intervalMonths: Number(row.interval_months), nextDueOn: String(row.next_due_on),
  lastPaidAt: row.last_paid_at ? String(row.last_paid_at) : null, payments,
});

export const listAdminRecurringCosts = async (): Promise<AdminRecurringCost[]> => {
  const client = getSupabaseAdmin();
  const [{ data: costs, error: costsError }, { data: paymentRows, error: paymentsError }] = await Promise.all([
    client.from('admin_recurring_costs').select('id,label,amount_cents,currency,interval_months,next_due_on,last_paid_at').eq('active', true).order('next_due_on'),
    client.from('admin_recurring_cost_payments').select('id,recurring_cost_id,amount_cents,currency,paid_at,next_due_on,note').order('paid_at', { ascending: false }).limit(100),
  ]);
  fail(costsError); fail(paymentsError);
  const paymentsByCost = new Map<string, AdminRecurringCostPayment[]>();
  ((paymentRows || []) as Row[]).forEach((row) => {
    const costId = String(row.recurring_cost_id);
    paymentsByCost.set(costId, [...(paymentsByCost.get(costId) || []), {
      id: String(row.id), amountCents: Number(row.amount_cents), currency: String(row.currency).trim(),
      paidAt: String(row.paid_at), nextDueOn: String(row.next_due_on), note: String(row.note || ''),
    }]);
  });
  return ((costs || []) as Row[]).map((row) => mapCost(row, paymentsByCost.get(String(row.id)) || []));
};

export const updateAdminRecurringCost = async (input: {
  id: string; label: string; amountCents: number; intervalMonths: number; nextDueOn: string;
}, actor: AuditActor) => {
  const label = input.label.trim().replace(/\s+/g, ' ');
  const due = new Date(`${input.nextDueOn}T00:00:00.000Z`);
  if (!uuid(input.id) || label.length < 3 || label.length > 120
    || !Number.isSafeInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > 100_000_000
    || !Number.isInteger(input.intervalMonths) || input.intervalMonths < 1 || input.intervalMonths > 120
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueOn) || Number.isNaN(due.getTime()) || due.toISOString().slice(0, 10) !== input.nextDueOn) {
    throw new Error('invalid_input');
  }

  const { error } = await getSupabaseAdmin().rpc('update_admin_recurring_cost', {
    p_cost_id: input.id, p_actor_user_id: actor.userId, p_label: label, p_amount_cents: input.amountCents,
    p_interval_months: input.intervalMonths, p_next_due_on: input.nextDueOn,
    p_request_id: actor.requestId || null, p_request_path: actor.requestPath || null,
  });
  if (error?.code === 'P0002') throw new Error('not_found');
  if (error?.code === '42501') throw new Error('not_allowed');
  if (error?.code === '22023') throw new Error('invalid_input');
  fail(error);
};

export const markAdminRecurringCostPaid = async (input: { id: string; note: string; actorId: string; requestId?: string; requestPath?: string }) => {
  if (!uuid(input.id) || !uuid(input.actorId) || input.note.length > 500) throw new Error('invalid_input');
  const { data, error } = await getSupabaseAdmin().rpc('mark_admin_recurring_cost_paid', {
    p_cost_id: input.id, p_actor_user_id: input.actorId, p_request_id: input.requestId || null,
    p_request_path: input.requestPath || null, p_note: input.note.trim(),
  });
  if (error?.code === 'P0002') throw new Error('not_found');
  if (error?.code === '42501') throw new Error('not_allowed');
  if (error?.code === '22023') throw new Error('invalid_input');
  fail(error);
  return Array.isArray(data) ? data[0] : data;
};

export const daysUntilDue = (date: string, now = new Date()) => {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(now);
  const dueMs = Date.parse(`${date}T00:00:00.000Z`);
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  return Math.round((dueMs - todayMs) / 86_400_000);
};

export const recurringIntervalLabel = (months: number) => {
  if (months === 12) return 'per jaar';
  if (months === 1) return 'per maand';
  if (months === 3) return 'per kwartaal';
  if (months === 6) return 'per halfjaar';
  return `elke ${months} maanden`;
};
