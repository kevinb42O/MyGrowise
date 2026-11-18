import {getSupabaseAdmin} from './supabase/server';
import {readAdminPage} from './adminPagination';
export const ADMIN_MAIL_QUEUES = [
  {table: 'support_mail_jobs', label: 'Support', leaseToken: false, lastError: true},
  {table: 'commerce_mail_jobs', label: 'Bestellingen', leaseToken: true, lastError: true},
  {table: 'booking_mail_jobs', label: 'Afspraken', leaseToken: true, lastError: true},
  {table: 'website_mail_jobs', label: 'Contact en aankooplinks', leaseToken: true, lastError: false},
] as const;
export const ADMIN_MAIL_STATES = [
  {value:'pending',label:'Gepland'},
  {value:'sending',label:'Bezig'},
  {value:'failed',label:'Mislukt'},
  {value:'sent',label:'Verzonden'},
  {value:'unconfirmed',label:'Overgeslagen of onbevestigd'},
] as const;
export type AdminMailStatus = typeof ADMIN_MAIL_STATES[number]['value'];
export type AdminMailCounts = {table:string;label:string;states:Record<AdminMailStatus,number>}[];
export type AdminMailQueue = typeof ADMIN_MAIL_QUEUES[number];
export const emptyMailStates = (): Record<AdminMailStatus,number> => ({pending:0,sending:0,failed:0,sent:0,unconfirmed:0});
export function selectedMailQueue(name: string) {
  return ADMIN_MAIL_QUEUES.find(queue=>queue.table===name) || null;
}
export function adminMailHref(url: URL, queue: string, status: string) {
  const target = new URL(url.pathname,url.origin);
  if (selectedMailQueue(queue)) target.searchParams.set('queue',queue);
  target.searchParams.set('status',ADMIN_MAIL_STATES.some(state=>state.value===status)?status:'sent');
  return target.pathname+target.search;
}
export function scopedMailCounts(counts: AdminMailCounts, queue: string) {
  const states = emptyMailStates();
  for (const item of counts.filter(item=>!selectedMailQueue(queue)||item.table===queue)) {
    for (const state of ADMIN_MAIL_STATES) states[state.value] += item.states[state.value];
  }
  return states;
}
export async function getAdminMailCounts(): Promise<AdminMailCounts> {
  const {data,error} = await getSupabaseAdmin().rpc('admin_mail_counts');
  if (error) throw new Error('Het mailoverzicht kon niet worden geladen. Probeer opnieuw.');
  return ADMIN_MAIL_QUEUES.map(queue=>{
    const states = emptyMailStates();
    for (const row of data || []) {
      if (row.queue===queue.table && ADMIN_MAIL_STATES.some(state=>state.value===row.status)) states[row.status as AdminMailStatus]=Number(row.total);
    }
    return {table:queue.table,label:queue.label,states};
  });
}
export function mailTitle(queue: string, kind: unknown) {
  const labels: Record<string,Record<string,string>> = {
    support_mail_jobs:{access:'Toegang tot supportgesprek',receipt:'Ontvangstbevestiging',reply:'Antwoord op supportvraag'},
    commerce_mail_jobs:{created:'Bestelbevestiging',paid:'Betalingsbevestiging',delivery:'Update over je aankoop'},
    booking_mail_jobs:{confirmation:'Afspraakbevestiging',rescheduled:'Afspraak verplaatst',cancelled:'Afspraak geannuleerd',reminder:'Afspraakherinnering'},
    website_mail_jobs:{contact:'Contactvraag',purchase_access:'Toegang tot aankopen'},
  };
  return typeof kind==='string' && Object.hasOwn(labels[queue]||{},kind) ? labels[queue][kind] : selectedMailQueue(queue)?.label || 'E-mail';
}
export interface AdminMailJob {
  id:string; queue:string; status:string; attempts:number; created_at:string; sent_at:string|null;
  next_attempt_at:string|null; lease_until:string|null; title:string; category:string; diagnosis:string;
}
interface MailProjection extends Omit<AdminMailJob,'title'|'category'|'diagnosis'> {
  kind:string; diagnosis_code:string|null; completion_outcome:string|null;
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
  const queue = selectedMailQueue(queueName);
  const selectedStatus = (ADMIN_MAIL_STATES.some(state=>state.value===status) ? status : 'sent') as AdminMailStatus;
  const result = await readAdminPage<MailProjection>((start,end)=>{
    let query = getSupabaseAdmin().from('admin_mail_overview')
      .select('id,queue,kind,status,attempts,created_at,sent_at,next_attempt_at,lease_until,diagnosis_code,completion_outcome',{count:'exact'})
      .eq('display_status',selectedStatus);
    if (queue) query=query.eq('queue',queue.table);
    const dateColumn = selectedStatus==='sent'?'sent_at':selectedStatus==='pending'?'next_attempt_at':selectedStatus==='sending'?'lease_until':'created_at';
    return query.order(dateColumn,{ascending:selectedStatus==='pending'||selectedStatus==='sending'}).order('queue').order('id').range(start,end);
  },page);
  const items: AdminMailJob[] = result.items.map(({kind,diagnosis_code,completion_outcome,...job})=>({
    ...job,title:mailTitle(job.queue,kind),category:selectedMailQueue(job.queue)?.label||'E-mail',
    diagnosis:selectedStatus==='unconfirmed'
      ? completion_outcome==='skipped'?'Overgeslagen; er is geen e-mail verzonden.':'Voor deze historische taak is succesvolle verzending niet bevestigd.'
      : mailDiagnosis(diagnosis_code),
  }));
  return {...result, queue, status:selectedStatus, items};
}
