import {getSupabaseAdmin} from './supabase/server';
import {readAdminPage} from './adminPagination';
export const ADMIN_MAIL_QUEUES = [
  {table: 'support_mail_jobs', label: 'Bestaande supportgesprekken', leaseToken: false, lastError: true},
  {table: 'commerce_mail_jobs', label: 'Bestellingen en afnames', leaseToken: true, lastError: true},
  {table: 'booking_mail_jobs', label: 'Afspraken', leaseToken: true, lastError: true},
  {table: 'website_mail_jobs', label: 'Contact en aankooplinks', leaseToken: true, lastError: false},
] as const;
export function mailDiagnosis(code: unknown) {
  const labels: Record<string,string> = {
    lease_expired: 'Verwerking onderbroken; bevestig eerst of de mail al is aangekomen.',
    delivery_failed: 'Verzenden mislukt. Controleer mailconfiguratie en bezorging bij de provider.',
    delivery_access_inactive: 'Geen actieve aankooptoegang; levering is overgeslagen.',
    smtp_not_configured: 'Mailserver is niet volledig ingesteld.',
    mail_not_configured: 'Mailserver is niet volledig ingesteld.',
  };
  // Never serialize arbitrary provider messages: they can include addresses, tokens or URLs.
  return typeof code === 'string' && labels[code] ? labels[code] : code ? 'Verzendfout. Controleer de mailconfiguratie en providerlogs.' : 'Geen aanvullende foutcode geregistreerd.';
}
export async function getAdminMailPage(queueName: string, status: string, page: unknown) {
  const queue = ADMIN_MAIL_QUEUES.find(queue=>queue.table===queueName) || ADMIN_MAIL_QUEUES[0];
  const selectedStatus = ['pending','sending','failed'].includes(status) ? status : 'failed';
  const result = await readAdminPage<Record<string,any>>((start,end)=>getSupabaseAdmin().from(queue.table).select(`id,status,attempts,created_at,next_attempt_at,lease_until${queue.lastError?',last_error':''}`,{count:'exact'}).eq('status',selectedStatus).order('created_at').order('id').range(start,end),page);
  return {...result, queue, status:selectedStatus, items:result.items.map(({last_error,...job})=>({...job,diagnosis:mailDiagnosis(last_error)}))};
}
