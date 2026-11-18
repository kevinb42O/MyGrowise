import {getSupabaseAdmin} from './supabase/server';
import {readAdminPage} from './adminPagination';
export const ADMIN_MAIL_QUEUES = [
  {table: 'support_mail_jobs', label: 'Bestaande supportgesprekken', leaseToken: false, lastError: true},
  {table: 'commerce_mail_jobs', label: 'Bestellingen en afnames', leaseToken: true, lastError: true},
  {table: 'booking_mail_jobs', label: 'Afspraken', leaseToken: true, lastError: true},
  {table: 'website_mail_jobs', label: 'Contact en aankooplinks', leaseToken: true, lastError: false},
] as const;
export const ADMIN_MAIL_STATES = [
  {value:'pending',label:'Gepland of wachtend'},
  {value:'sending',label:'Bezig'},
  {value:'failed',label:'Mislukt'},
  {value:'sent',label:'Verzonden'},
  {value:'unconfirmed',label:'Overgeslagen of onbevestigd'},
] as const;
export type AdminMailStatus = typeof ADMIN_MAIL_STATES[number]['value'];
export type AdminMailCounts = {table:string;label:string;states:Record<AdminMailStatus,number>}[];
type MailQueue = typeof ADMIN_MAIL_QUEUES[number];

// Counts and history must use the same definition of a successful transmission.
function mailQuery(queue: MailQueue, status: AdminMailStatus, head = false) {
  let query = getSupabaseAdmin().from(queue.table).select(head ? 'id' : `id,status,attempts,created_at,sent_at,next_attempt_at,lease_until${queue.lastError?',last_error':''}${queue.table==='website_mail_jobs'?',delivery_outcome':''}`,{count:'exact',head});
  if (status !== 'sent' && status !== 'unconfirmed') return query.eq('status',status);
  query = query.eq('status','sent');
  if (status === 'sent') {
    query = query.not('sent_at','is',null);
    if (queue.table === 'commerce_mail_jobs') return query.or('last_error.is.null,last_error.neq.delivery_access_inactive');
    if (queue.table === 'website_mail_jobs') return query.eq('delivery_outcome','sent');
    return query;
  }
  if (queue.table === 'commerce_mail_jobs') return query.or('sent_at.is.null,last_error.eq.delivery_access_inactive');
  if (queue.table === 'website_mail_jobs') return query.or('sent_at.is.null,delivery_outcome.is.null,delivery_outcome.eq.skipped');
  return query.is('sent_at',null);
}

export async function getAdminMailCounts(): Promise<AdminMailCounts> {
  return Promise.all(ADMIN_MAIL_QUEUES.map(async queue => {
    const entries = await Promise.all(ADMIN_MAIL_STATES.map(async state => {
      const {count,error} = await mailQuery(queue,state.value,true);
      if (error) throw new Error('Mailwachtrij tijdelijk niet beschikbaar.');
      return [state.value,count||0] as const;
    }));
    return {table:queue.table,label:queue.label,states:Object.fromEntries(entries) as Record<AdminMailStatus,number>};
  }));
}
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
  const selectedStatus = (ADMIN_MAIL_STATES.some(state=>state.value===status) ? status : 'failed') as AdminMailStatus;
  const result = await readAdminPage<Record<string,any>>((start,end)=>mailQuery(queue,selectedStatus).order(selectedStatus==='sent'?'sent_at':'created_at',{ascending:selectedStatus!=='sent'}).order('id').range(start,end),page);
  return {...result, queue, status:selectedStatus, items:result.items.map(({last_error,delivery_outcome,...job})=>({...job,diagnosis:selectedStatus==='unconfirmed' ? delivery_outcome==='skipped'||last_error==='delivery_access_inactive' ? 'Overgeslagen; er is geen e-mail verzonden.' : 'Voor deze historische taak is succesvolle verzending niet bevestigd.' : mailDiagnosis(last_error)}))};
}
