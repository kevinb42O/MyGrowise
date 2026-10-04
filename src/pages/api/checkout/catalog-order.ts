import {deliverCommerceMail} from '../../../lib/catalog/mail';
import type { APIRoute } from 'astro';
import { isTrustedFormOrigin,isCustomerAccount } from '../../../lib/adminAuth';
import {isUuid} from '../../../lib/catalog/pricing';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {getWiseManualDetails} from '../../../lib/wiseCheckout';
export const POST: APIRoute=async({request,locals})=>{
 if(!isTrustedFormOrigin(request))return new Response('Ongeldige aanvraag.',{status:403});
 if(!isCustomerAccount(locals.currentUser))return new Response('Meld je aan met een klantaccount.',{status:401});
 try{const form=await request.formData();const ids=String(form.get('ids')||'').split(',');const mode=String(form.get('mode')||'');const key=String(form.get('submission')||'');const hash=String(form.get('hash')||'');
 if(form.get('terms')!=='accepted')return new Response('Aanvaard de voorwaarden om te bestellen.',{status:400});
 if(!ids.length||ids.length>30||ids.some(x=>!isUuid(x))||!['package','custom'].includes(mode)||!isUuid(key)||!/^[a-f0-9]{32}$/.test(hash)||!getWiseManualDetails())return new Response('Controleer je samenstelling.',{status:400});
 const {data,error}=await getSupabaseAdmin().rpc('create_catalog_order',{p_customer_id:locals.currentUser!.sub,p_ids:ids,p_mode:mode,p_hash:hash,p_submission:key});
 if(error){const back=`/bestellen?${mode==='package'?'pakket':'vragenlijsten'}=${ids.join(',')}&melding=gewijzigd`;return Response.redirect(new URL(back,request.url),303);}
 await deliverCommerceMail(2,String(data)).catch(()=>undefined);
 return Response.redirect(new URL(`/bestellen?order=${data}`,request.url),303);
 }catch{return new Response('Je bestelling kon niet worden aangemaakt. Probeer opnieuw.',{status:503});}
};
