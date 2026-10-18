import type {APIRoute} from 'astro';
import {hasPermission,isTrustedFormOrigin} from '../../../lib/adminAuth';
import {deliverQueuedMail} from '../../../lib/mailWorker';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
export const POST:APIRoute=async({request,locals})=>{
 if(!isTrustedFormOrigin(request)||!hasPermission(locals.adminUser,'integrations.manage'))return new Response('Geen toegang.',{status:403});
 try{
  const form=await request.formData();
  if(form.get('retry_failed')==='1'){
   if(form.get('checked')!=='yes')return new Response('Controleer eerst de oorzaak.',{status:400});
   const db=getSupabaseAdmin();
   for(const table of ['support_mail_jobs','commerce_mail_jobs','booking_mail_jobs','website_mail_jobs']){
    const {error}=await db.from(table).update({status:'pending',attempts:0,next_attempt_at:new Date().toISOString(),lease_until:null}).eq('status','failed');
    if(error)throw new Error('retry_failed');
   }
   const {error}=await db.from('security_audit_log').insert({actor_user_id:locals.adminUser!.sub,action:'mail.failed_requeued',object_type:'mail_queue',object_id:'all',metadata:{requestId:locals.requestId}});if(error)throw new Error('audit_failed');
  }
  await deliverQueuedMail();
  return Response.redirect(new URL('/admin/mail?processed=1',request.url),303);
 }catch{return new Response('Mailverwerking tijdelijk niet beschikbaar. Taken blijven bewaard.',{status:503});}
};
export const ALL:APIRoute=()=>new Response('Methode niet toegestaan.',{status:405});
