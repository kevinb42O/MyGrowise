import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabase/server';
import {deliverCommerceMail} from '../../../../lib/catalog/mail';
export const POST:APIRoute=async({request,locals})=>{if(!isTrustedFormOrigin(request)||!locals.adminUser?.roles.includes('super_admin'))return new Response('Geen toegang.',{status:403});const db=getSupabaseAdmin();const {error}=await db.from('commerce_mail_jobs').update({status:'pending',attempts:0,next_attempt_at:new Date().toISOString(),lease_until:null,lease_token:null}).eq('status','failed');if(error)return new Response('Opnieuw proberen mislukt.',{status:503});await deliverCommerceMail(4).catch(()=>undefined);return Response.redirect(new URL('/admin/vragenlijsten?mail=verwerkt',request.url),303);};
