import nodemailer from 'nodemailer';
import {getSupabaseAdmin} from '../supabase/server';
import {supportMailReady} from '../supportMail';
import {money} from './pricing';
export async function deliverCommerceMail(limit=4,orderId?:string){
 if(!supportMailReady())return {sent:0,failed:0,configured:false};
 const db=getSupabaseAdmin();const {data:jobs,error}=await db.rpc('claim_commerce_mail',{p_limit:limit,p_order_id:orderId||null});if(error)throw new Error('mail_claim_failed');
 const transport=nodemailer.createTransport({host:'smtp.mail.webnode.com',port:465,secure:true,auth:{user:import.meta.env.SUPPORT_SMTP_USER,pass:import.meta.env.SUPPORT_SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:10000});
 const origin=(import.meta.env.PUBLIC_SITE_URL||(import.meta.env.PROD?'https://mygrowise.vercel.app':'http://localhost:4321')).replace(/\/$/,'');let sent=0,failed=0;
 for(const job of jobs||[]){try{
  const {data:order,error:oe}=await db.from('orders').select('customer_user_id,provider_reference,total_cents,status').eq('id',job.order_id).single();if(oe||!order)throw new Error('order_missing');
  if(job.event==='delivery'&&!['paid','fulfilled'].includes(order.status)){await db.from('commerce_mail_jobs').update({status:'sent',sent_at:new Date().toISOString(),lease_until:null,last_error:'delivery_access_inactive'}).eq('id',job.id).eq('lease_token',job.lease_token);continue;}
  let recipient=import.meta.env.SUPPORT_FROM_EMAIL?.trim()||'';if(job.target==='customer'){const {data,error}=await db.auth.admin.getUserById(order.customer_user_id);if(error||!data.user?.email)throw new Error('recipient_missing');recipient=data.user.email;}
  const team=job.target==='team';const event=job.event;const subject=team?(event==='created'?'Nieuwe bestelling — MyGrowise':'Betaling bevestigd — MyGrowise'):event==='created'?'Je bestelling is ontvangen — MyGrowise':event==='paid'?'Je betaling is bevestigd — MyGrowise':'Er staat een update voor je klaar — MyGrowise';
  const intro=team?(event==='created'?'Er is een nieuwe bestelling om op te volgen.':'Een betaling is bevestigd. De afnames staan klaar voor opvolging.'):event==='created'?'Je bestelling is ontvangen. De overschrijvingsgegevens vind je in je account.':event==='paid'?'Je betaling is bevestigd. MyGrowise bereidt je afname voor.': 'Er staat een update over je afname voor je klaar. Bekijk je instructies en beschikbare rapporten veilig in je account.';
  const link=team?`${origin}/admin/${event==='paid'?'afnames':'bestellingen'}`:event==='created'?`${origin}/bestellen?order=${job.order_id}`:`${origin}/account/bibliotheek`;
  const text=`${intro}\n\nReferentie: ${order.provider_reference}${event!=='delivery'?`\nBedrag: ${money(order.total_cents)}`:''}\n\n${link}\n\nDeel geen medische gegevens via gewone e-mail.\n\nMyGrowise`;
  await transport.sendMail({from:`MyGrowise <${import.meta.env.SUPPORT_FROM_EMAIL}>`,to:recipient,replyTo:import.meta.env.SUPPORT_FROM_EMAIL,subject,text});
  const {error}=await db.from('commerce_mail_jobs').update({status:'sent',sent_at:new Date().toISOString(),lease_until:null,last_error:null}).eq('id',job.id).eq('lease_token',job.lease_token);if(error)throw new Error('mail_status_failed');sent++;
 }catch{await db.from('commerce_mail_jobs').update({status:job.attempts>=6?'failed':'pending',next_attempt_at:new Date(Date.now()+Math.min(2**job.attempts*60000,21600000)).toISOString(),lease_until:null,last_error:'delivery_failed'}).eq('id',job.id).eq('lease_token',job.lease_token);failed++;}}
 transport.close();return {sent,failed,configured:true};
}
