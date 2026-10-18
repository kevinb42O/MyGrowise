import {sendWebsiteEmail,websiteMailReady} from './commerce/websiteMail';
import {getSupabaseAdmin} from './supabase/server';
import {bookingMailContent,type BookingMailPayload} from './bookingMailContent';
export async function deliverBookingMail(limit=4,bookingId?:string){
 if(!websiteMailReady())return {sent:0,failed:0,configured:false};
 const db=getSupabaseAdmin();
 const {data:jobs,error}=await db.rpc('claim_booking_mail',{p_limit:limit,p_booking:bookingId||null});
 if(error)throw new Error('mail_claim_failed');
 let sent=0,failed=0;
 for(const job of jobs||[]){try{
   const mail=bookingMailContent(job.kind,job.payload as BookingMailPayload);
   await sendWebsiteEmail(job.recipient,mail.subject,mail.text,import.meta.env.SUPPORT_FROM_EMAIL,`<booking-${job.id}@mygrowise.be>`);
   const {error}=await db.from('booking_mail_jobs').update({status:'sent',sent_at:new Date().toISOString(),lease_until:null,last_error:null}).eq('id',job.id).eq('lease_token',job.lease_token);
   if(error)throw new Error('mail_status_failed');sent++;
 }catch{
   await db.from('booking_mail_jobs').update({status:job.attempts>=6?'failed':'pending',next_attempt_at:new Date(Date.now()+Math.min(2**job.attempts*60000,21600000)).toISOString(),lease_until:null,last_error:'delivery_failed'}).eq('id',job.id).eq('lease_token',job.lease_token);failed++;
 }}
 return {sent,failed,configured:true};
}
