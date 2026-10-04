import {deliverCommerceMail} from '../../../../lib/catalog/mail';
import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../../lib/adminAuth';
import {getDelivery} from '../../../../lib/catalog/server';
import {safeExternalUrl,isUuid} from '../../../../lib/catalog/pricing';
import {getSupabaseAdmin} from '../../../../lib/supabase/server';
export const POST:APIRoute=async({request,params,locals})=>{
 if(!isTrustedFormOrigin(request)||!locals.adminUser?.roles.includes('super_admin'))return new Response('Geen toegang.',{status:403});
 if(!isUuid(params.id))return new Response('Afname niet gevonden.',{status:404});
 if(Number(request.headers.get('content-length')||0)>16*1024*1024)return new Response('Het rapport is te groot (maximaal 15 MB).',{status:413});
 let uploaded:string|null=null;
 try{const existing=await getDelivery(params.id);if(!existing)return new Response('Afname niet gevonden.',{status:404});
 const form=await request.formData();const status=String(form.get('status')||'');const instructions=String(form.get('instructions')||'').trim();const rawUrl=String(form.get('externalUrl')||'').trim();const url=safeExternalUrl(rawUrl);
 if(!['pending','invited','received','completed'].includes(status)||instructions.length>5000||rawUrl.length>2000||url===null)return new Response('Controleer status, instructies en HTTPS-link. Gebruik Terug om te corrigeren.',{status:400});
 const db=getSupabaseAdmin();const file=form.get('report');if(file instanceof File&&file.size>0){if(file.size>15*1024*1024)return new Response('Maximaal 15 MB.',{status:413});const bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString()!=='%PDF-')return new Response('Upload een geldig PDF-bestand.',{status:400});uploaded=`${existing.customer_user_id}/${existing.id}/${crypto.randomUUID()}.pdf`;const {error}=await db.storage.from('assessment-reports').upload(uploaded,bytes,{contentType:'application/pdf',upsert:false});if(error)throw new Error('upload_failed');}
 const {error}=await db.rpc('update_assessment_delivery',{p_actor:locals.adminUser.sub,p_id:existing.id,p_status:status,p_instructions:instructions,p_url:url,p_report:uploaded});if(error)throw new Error('save_failed');
 await deliverCommerceMail(4,existing.order_items.order_id).catch(()=>undefined);
 return Response.redirect(new URL(`/admin/afnames/${existing.id}?opgeslagen=1`,request.url),303);
 }catch{if(uploaded)await getSupabaseAdmin().storage.from('assessment-reports').remove([uploaded]);return new Response('Opslaan mislukt. Probeer opnieuw.',{status:503});}
};
