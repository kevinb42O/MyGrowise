import { websiteMailReady } from './commerce/websiteMail';
import { getSupabaseAdmin } from './supabase/server';
import { hasPermission, type UserSession } from './adminAuth';
import { getPracticeNoteTasks } from './clientRecords';
import type { PracticeBooking } from './practiceStore';
import { buildPracticeTasks } from './practiceWorkday';

export type AttentionItem = { key: string; href: string; label: string; count: number };
export type AttentionSummary = { items: AttentionItem[]; unavailable: string[]; checkedAt: string };

/** Counts actionable state independently of dismissible notification receipts. */
export async function getAdminAttention(user: UserSession, surface: 'admin' | 'practice', requestId?: string): Promise<AttentionSummary> {
  const db = getSupabaseAdmin();
  const now = new Date();
  const items: AttentionItem[] = [];
  const unavailable: string[] = [];
  const checks: Promise<void>[] = [];
  const check = (key: string, href: string, label: string, read: () => PromiseLike<{ count: number | null; error: unknown }>) => {
    checks.push(Promise.resolve().then(read).then(result => {
      if (result.error) throw result.error;
      items.push({ key, href, label, count: result.count || 0 });
    }).catch(() => { unavailable.push(key); }));
  };
  const base = surface === 'practice' ? '/praktijk' : '/admin';
  check('messages', `${base}/berichten?view=team`, 'Ongelezen teammeldingen', () => db.from('internal_notifications').select('id', { count: 'exact', head: true }).eq('recipient_user_id', user.sub).eq('notification_type', 'internal_message').is('read_at', null));
  if (hasPermission(user, 'support.read')) {
    check('supportNotifications', `${base}/berichten`, 'Ongelezen klantmeldingen', () => db.from('internal_notifications').select('id', { count: 'exact', head: true }).eq('recipient_user_id', user.sub).eq('notification_type', 'support_message').is('read_at', null));
    check('support', `${base}/berichten`, 'Klantvragen op te volgen', () => db.from('support_conversations').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress']));
  }
  if (surface === 'practice') {
    if (!user.practitionerId || !user.roles.includes('practitioner')) throw new Error('forbidden');
    check('bookings', '/praktijk/boekingen?status=pending', 'Boekingsaanvragen', () => db.from('bookings').select('id', { count: 'exact', head: true }).eq('practitioner_id', user.practitionerId).eq('status', 'pending'));
    if (hasPermission(user, 'client_records.write')) checks.push((async () => {
      const records = await getPracticeNoteTasks(user, requestId);
      const bookings: Pick<PracticeBooking, 'id' | 'patientId' | 'clientName' | 'startsAt' | 'endsAt' | 'status'>[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db.from('bookings').select('id,patient_id,client_name,starts_at,ends_at,status')
          .eq('practitioner_id', user.practitionerId).in('status', ['confirmed', 'completed']).lte('ends_at', now.toISOString())
          .order('id').range(offset, offset + 499);
        if (error) throw error;
        bookings.push(...(data || []).map(row => ({ id: row.id, patientId: row.patient_id, clientName: row.client_name, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status })));
        if (!data || data.length < 500) break;
      }
      items.push({ key: 'reports', href: '/praktijk#workday-tasks', label: 'Verslagen op te volgen', count: buildPracticeTasks(user, records, bookings, now).length });
    })().catch(() => { unavailable.push('reports'); }));
  } else {
    if (hasPermission(user, 'orders.read')) {
      check('payments', '/admin/bestellingen?status=overschrijvingen', 'Open overschrijvingen', () => db.from('orders').select('id', { count: 'exact', head: true }).eq('provider', 'wise_manual').eq('status', 'pending_payment'));
      check('disputes', '/admin/bestellingen?status=disputed', 'Betwiste bestellingen', () => db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'disputed'));
    }
    if (hasPermission(user, 'bookings.read')) check('bookings', '/admin/boekingen?status=pending', 'Boekingsaanvragen', () => db.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'));
    if (hasPermission(user, 'assessments.manage')) {
      check('assessmentsPending', '/admin/afnames?status=pending', 'Afnames voorbereiden', () => db.from('assessment_deliveries').select('id,order_items!inner(orders!inner(status))', { count: 'exact', head: true }).eq('status', 'pending').in('order_items.orders.status', ['paid', 'fulfilled']));
      check('assessmentsReceived', '/admin/afnames?status=received', 'Ontvangen afnames opvolgen', () => db.from('assessment_deliveries').select('id,order_items!inner(orders!inner(status))', { count: 'exact', head: true }).eq('status', 'received').in('order_items.orders.status', ['paid', 'fulfilled']));
    }
    if (hasPermission(user, 'privacy.read')) check('privacy', '/admin/privacy', 'Open privacyverzoeken', () => db.from('data_subject_requests').select('id', { count: 'exact', head: true }).in('status', ['received', 'in_progress']));
    if (hasPermission(user, 'operations.manage')) check('tasks', '/admin/instellingen#acties', 'Open werkpunten', () => db.from('admin_work_items').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'blocked']));
    if (hasPermission(user, 'products.review')) check('products', '/admin/producten?status=review', 'Producten ter beoordeling', () => db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'review'));
    if (hasPermission(user, 'content.publish')) check('content', '/admin/content?status=review', 'Content ter beoordeling', () => db.from('content_items').select('id', { count: 'exact', head: true }).eq('status', 'review'));
    if (hasPermission(user, 'integrations.read')) {
      const due = new Date(now.getTime() + 30 * 86400000);
      const dueOn = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(due);
      check('costs', '/admin/instellingen#kosten', 'Kosten binnen 30 dagen of achterstallig', () => db.from('admin_recurring_costs').select('id', { count: 'exact', head: true }).eq('active', true).lte('next_due_on', dueOn));
      check('integrations', '/admin/instellingen#integraties', 'Integraties met storing', () => db.from('integration_status').select('key', { count: 'exact', head: true }).in('state', ['degraded', 'failed']));
    }
    if (hasPermission(user, 'integrations.manage')) {
      items.push({ key: 'mail:configuration', href: '/admin/mail', label: 'Mailconfiguratie controleren', count: websiteMailReady() ? 0 : 1 });
      for (const table of ['support_mail_jobs', 'commerce_mail_jobs', 'booking_mail_jobs', 'website_mail_jobs']) {
        check(`mail:${table}`, '/admin/mail', 'Mail vereist opvolging', () => db.from(table).select('id', { count: 'exact', head: true })
          .or(`status.eq.failed,and(status.eq.pending,created_at.lt.${new Date(now.getTime() - 86400000).toISOString()}),and(status.eq.sending,lease_until.lt.${now.toISOString()})`));
      }
    }
  }
  await Promise.all(checks);
  return { items: items.sort((a, b) => a.key.localeCompare(b.key)), unavailable: unavailable.sort(), checkedAt: now.toISOString() };
}
