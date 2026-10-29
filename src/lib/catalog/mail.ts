import {sendWebsiteEmail,websiteMailReady} from '../commerce/websiteMail';
import {makePurchaseLink} from '../commerce/purchases';
import {getSupabaseAdmin} from '../supabase/server';
import {money} from './pricing';
import {termsForEmail} from '../commerce/terms';
export async function deliverCommerceMail(limit=4,orderId?:string){
 if(!websiteMailReady())return {sent:0,failed:0,configured:false};
 const db=getSupabaseAdmin();const {data:jobs,error}=await db.rpc('claim_commerce_mail',{p_limit:limit,p_order_id:orderId||null});if(error)throw new Error('mail_claim_failed');

 const origin=(import.meta.env.PUBLIC_SITE_URL||(import.meta.env.PROD?'https://mygrowise.vercel.app':'http://localhost:4321')).replace(/\/$/,'');let sent=0,failed=0;
 for(const job of jobs||[]){try{
  const {data:order,error:oe}=await db.from('orders').select('customer_user_id,contact_snapshot,provider_reference,total_cents,status,commerce_buyers!orders_buyer_id_fkey(email,first_name,last_name),order_items(product_type,product_title)').eq('id',job.order_id).single();if(oe||!order)throw new Error('order_missing');
  if(job.event==='delivery'&&!['paid','fulfilled'].includes(order.status)){await db.from('commerce_mail_jobs').update({status:'sent',sent_at:new Date().toISOString(),lease_until:null,last_error:'delivery_access_inactive'}).eq('id',job.id).eq('lease_token',job.lease_token);continue;}
  const buyer=Array.isArray(order.commerce_buyers)?order.commerce_buyers[0]:order.commerce_buyers;
  const email=order.contact_snapshot?.email||buyer?.email;const recipient=job.target==='team'?'info@mygrowise.be':email;if(!recipient)throw new Error('recipient_missing');
  const types=new Set((order.order_items||[]).map((i:any)=>i.product_type));const modulesOnly=[...types].every(type=>['module','guide'].includes(type));const paidIntro=modulesOnly?'Je aangekochte inhoud staat klaar bij Mijn aankopen.':(types.has('module')||types.has('guide'))?'Je digitale inhoud staat klaar bij Mijn aankopen. MyGrowise bereidt je vragenlijstafnames voor.':'MyGrowise bereidt je afname voor.';
  const team=job.target==='team';const event=job.event;const subject=team?(event==='created'?'Nieuwe bestelling — MyGrowise':'Betaling bevestigd — MyGrowise'):event==='created'?'Je bestelling is ontvangen — MyGrowise':event==='paid'?'Je betaling is bevestigd — MyGrowise':'Er staat een update voor je klaar — MyGrowise';
  const intro=team?(event==='created'?'Er is een nieuwe bestelling om op te volgen.':'Een betaling is bevestigd. Bekijk de gekochte producten en hun levering.'):event==='created'?'Je bestelling is ontvangen. Open je bestelling en betaalgegevens via de link hieronder. Een account is niet nodig.':event==='paid'?`Je betaling is bevestigd. ${paidIntro}`: 'Er staat een update over je afname voor je klaar. Open je instructies en beschikbare rapporten veilig via de link hieronder, zonder verplicht account.';
  const link=team?`${origin}/admin/${event==='paid'?(modulesOnly?'modules':'afnames'):'bestellingen'}`:event==='created'?await makePurchaseLink(email,`/bestellen?order=${job.order_id}`):await makePurchaseLink(email);
  const text=`${intro}\n\nReferentie: ${order.provider_reference}\n${team?`Producten: ${order.order_items.map((i:any)=>i.product_title).join(' · ')}`:'Je vindt de inhoud van je bestelling via de beveiligde link.'}${event!=='delivery'?`\nBedrag: ${money(order.total_cents)}`:''}\n\n${team?`Contact: ${buyer!.email}\nDeelnemer: ${order.contact_snapshot?.first_name||buyer!.first_name} ${order.contact_snapshot?.last_name||buyer!.last_name}\n\n`:''}${link}\n\nDeel geen medische gegevens via gewone e-mail.\n\nMyGrowise`;
  const message=!team&&event==='created'?`${text}\n\n${termsForEmail()}`:text;
  await sendWebsiteEmail(recipient,subject,message);
  const {error}=await db.from('commerce_mail_jobs').update({status:'sent',sent_at:new Date().toISOString(),lease_until:null,last_error:null}).eq('id',job.id).eq('lease_token',job.lease_token);if(error)throw new Error('mail_status_failed');sent++;
 }catch{await db.from('commerce_mail_jobs').update({status:job.attempts>=6?'failed':'pending',next_attempt_at:new Date(Date.now()+Math.min(2**job.attempts*60000,21600000)).toISOString(),lease_until:null,last_error:'delivery_failed'}).eq('id',job.id).eq('lease_token',job.lease_token);failed++;}}
 return {sent,failed,configured:true};
}
