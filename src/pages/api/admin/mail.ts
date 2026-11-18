import type {APIRoute} from 'astro';
import {hasPermission,isTrustedFormOrigin} from '../../../lib/adminAuth';
import {deliverQueuedMail} from '../../../lib/mailWorker';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {ADMIN_MAIL_QUEUES} from '../../../lib/adminMail';
export const POST:APIRoute=async({request,locals})=>{
 if(!isTrustedFormOrigin(request)||!hasPermission(locals.adminUser,'integrations.manage'))return new Response('Geen toegang.',{status:403});
 try{
  const form=await request.formData();
  if(form.get('retry_failed')==='1'){
   if(form.get('checked')!=='yes')return new Response('Controleer eerst de oorzaak en bevestig dat opnieuw proberen nodig is.',{status:400});
   const queue = String(form.get('queue') || '');
   const job = String(form.get('job_id') || '');
   if ((queue && !ADMIN_MAIL_QUEUES.some(item=>item.table===queue)) || (job && (!queue || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job)))) return new Response('Ongeldige mailselectie.',{status:400});
   const db=getSupabaseAdmin();
   // Record the request before changing jobs; an audit failure must never silently requeue mail.
   const {error:auditError}=await db.from('security_audit_log').insert({actor_user_id:locals.adminUser!.sub,action:'mail.retry_requested',object_type:'mail_queue',object_id:job||queue||'all',metadata:{queue:queue||'all',requestId:locals.requestId}});
   if(auditError)throw new Error('audit_failed');
   for(const item of ADMIN_MAIL_QUEUES.filter(item=>!queue||item.table===queue)){
    const query=db.from(item.table).update({status:'pending',attempts:0,next_attempt_at:new Date().toISOString(),lease_until:null,...(item.leaseToken?{lease_token:null}:{})}).eq('status','failed');
    if(job)query.eq('id',job);
    const {error}=await query;
    if(error)throw new Error('retry_failed');
   }
  }
  const outcome = await deliverQueuedMail();
  if (outcome && Object.values(outcome).some(queue => 'unavailable' in queue && queue.unavailable)) throw new Error('queue_unavailable');
  return Response.redirect(new URL('/admin/mail?processed=1',request.url),303);
 }catch{return Response.redirect(new URL('/admin/mail?error=processing_failed',request.url),303);}
};
export const ALL:APIRoute=()=>new Response('Methode niet toegestaan.',{status:405});
