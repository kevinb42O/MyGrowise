import nodemailer from 'nodemailer';
import {getSupabaseAdmin} from '../supabase/server';
import {supportMailReady} from '../supportMail';
import {makePurchaseLink} from './purchases';
import {renderEmail,renderTextEmail} from '../emailTemplate';
export const captureMail=()=>!import.meta.env.PROD&&import.meta.env.WEBSITE_MAIL_MODE==='capture';
export const websiteMailReady=()=>captureMail()||supportMailReady();
export type WebsiteMailAttachment = {filename:string;content:string;contentType:string};
export async function sendWebsiteEmail(to:string,subject:string,text:string,replyTo='info@mygrowise.be',messageId?:string,html=renderTextEmail(subject,text),attachments:WebsiteMailAttachment[]=[],smtpPort:465|587=465){
 if(import.meta.env.DEV&&captureMail()){
  const {captureEmail}=await import('./captureMail');
  return captureEmail(to,subject,text,replyTo,messageId,html,attachments);
 }
 if(!supportMailReady())throw new Error('mail_unavailable');
 const transport=nodemailer.createTransport({host:'smtp.mail.webnode.com',port:smtpPort,secure:smtpPort===465,...(smtpPort===587?{requireTLS:true}:{}),auth:{user:import.meta.env.SUPPORT_SMTP_USER,pass:import.meta.env.SUPPORT_SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:10000});
 try{await transport.sendMail({from:`MyGrowise <${import.meta.env.SUPPORT_FROM_EMAIL}>`,to,replyTo,subject,text,html,messageId,attachments});}finally{transport.close();}
}
export async function queueWebsiteMail(kind:'contact'|'purchase_access',payload:Record<string,string>,submission?:string){
 const {error}=await getSupabaseAdmin().from('website_mail_jobs').upsert({kind,payload,submission_key:submission||null},{onConflict:'submission_key',ignoreDuplicates:true});if(error)throw new Error('mail_queue_failed');
}
export async function deliverWebsiteMail(limit=10){
 if(!websiteMailReady())return {sent:0,failed:0,configured:false};
 const db=getSupabaseAdmin();await db.from('website_mail_jobs').update({status:'failed',lease_until:null}).eq('status','sending').gte('attempts',6).lt('lease_until',new Date().toISOString());const {data,error}=await db.rpc('claim_website_mail',{p_limit:limit});if(error)throw new Error('mail_claim_failed');let sent=0,failed=0;
 for(const job of data||[]){try{
  const p=job.payload as Record<string,string>;
  let transmitted=job.kind==='contact';
  let recipientName=job.kind==='contact'?'MyGrowise-team':'';
  let clientName=job.kind==='contact'?String(p.name||''):'';
  if(job.kind==='contact')await sendWebsiteEmail('info@mygrowise.be',`Contactvraag: ${p.category}`,`Naam: ${p.name}\nE-mail: ${p.email}\nOnderwerp: ${p.category}\n\n${p.body}`,p.email,undefined,renderEmail({title:'Een nieuwe contactvraag.',preheader:`${p.name} heeft een vraag over ${p.category}.`,paragraphs:['Je kunt deze vraag beantwoorden door op deze e-mail te reageren.'],details:[['Van',p.name],['E-mailadres',p.email],['Onderwerp',p.category]],sections:[{title:'Het bericht',body:p.body}]}));
  else{const contact=await db.from('orders').select('id,contact_snapshot').eq('contact_snapshot->>email',p.email).limit(1);if(contact.error)throw new Error('buyer_lookup');const known=await db.from('commerce_buyers').select('id,first_name,last_name').eq('email',p.email).limit(1);if(known.error)throw new Error('buyer_lookup');if(known.data?.length||contact.data?.length){transmitted=true;const buyer=known.data?.[0];const contactName=contact.data?.[0]?.contact_snapshot;clientName=[contactName?.first_name||buyer?.first_name,contactName?.last_name||buyer?.last_name].filter(Boolean).join(' ').trim();recipientName=clientName;const link=await makePurchaseLink(p.email,p.next);await sendWebsiteEmail(p.email,'Open je aankopen — MyGrowise',`Met deze eenmalige link open je jouw aankopen, zonder account of wachtwoord. De link is 30 minuten geldig.\n\n${link}\n\nNiet aangevraagd? Dan mag je deze e-mail negeren.\n\nMyGrowise`,undefined,undefined,renderEmail({title:'Jouw aankopen, binnen handbereik.',preheader:'Open je aankopen veilig, zonder wachtwoord.',paragraphs:['Je vroeg een link aan om je aankopen te bekijken. Met de knop hieronder open je jouw materialen, instructies en beschikbare rapporten. Een account of wachtwoord is niet nodig.'],action:{label:'Open mijn aankopen',url:link},note:'Deze persoonlijke link is eenmalig te gebruiken en 30 minuten geldig. Deel hem niet met anderen. Heb je de link niet aangevraagd? Dan kun je deze e-mail negeren.'}));}}
  const done=await db.from('website_mail_jobs').update({status:'sent',sent_at:transmitted?new Date().toISOString():null,delivery_outcome:transmitted?'sent':'skipped',recipient_email_snapshot:transmitted?(job.kind==='contact'?'info@mygrowise.be':p.email):null,recipient_name_snapshot:transmitted?recipientName||null:null,client_name_snapshot:transmitted?clientName||null:null,lease_until:null}).eq('id',job.id).eq('lease_token',job.lease_token);if(done.error)throw new Error('mail_status_failed');if(transmitted)sent++;
 }catch{await db.from('website_mail_jobs').update({status:job.attempts>=6?'failed':'pending',next_attempt_at:new Date(Date.now()+Math.min(2**job.attempts*60000,21600000)).toISOString(),lease_until:null}).eq('id',job.id).eq('lease_token',job.lease_token);failed++;}}
 await db.from('commerce_access_tokens').delete().lt('expires_at',new Date().toISOString());
 await db.from('commerce_sessions').delete().lt('expires_at',new Date().toISOString());
 await db.from('website_mail_jobs').delete().eq('status','sent').lt('created_at',new Date(Date.now()-365*86400000).toISOString());
 return {sent,failed,configured:true};
}
