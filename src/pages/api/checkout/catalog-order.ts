import {salesEnabled,salesPausedMessage} from '../../../lib/commerce/readiness';
import {deliverCommerceMail} from '../../../lib/catalog/mail';
import type {APIRoute} from 'astro';
import {isTrustedFormOrigin,isCustomerAccount} from '../../../lib/adminAuth';
import {isUuid} from '../../../lib/catalog/pricing';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {getWiseManualDetails} from '../../../lib/wiseCheckout';
import {rateLimitSupport} from '../../../lib/supportMail';
import {CHECKOUT_COOKIE,digest,tokenValid,parseBuyer,privateHeaders,purchaseOwner,purchasedProducts} from '../../../lib/commerce/purchases';
export const POST:APIRoute=async({request,locals,cookies})=>{
 if(!isTrustedFormOrigin(request))return new Response('Ongeldige aanvraag.',{status:403});
 if(!salesEnabled())return new Response(salesPausedMessage,{status:503,headers:privateHeaders});
 if(Number(request.headers.get('content-length')||0)>16000)return new Response('Controleer je gegevens.',{status:413});
 try{
  const form=await request.formData(),ids=String(form.get('ids')||'').split(','),mode=String(form.get('mode')||''),key=String(form.get('submission')||''),hash=String(form.get('hash')||'');
  if(form.get('website'))return new Response('Controleer je gegevens.',{status:400});
  if(form.get('terms')!=='accepted'||!ids.length||ids.length>30||ids.some(x=>!isUuid(x))||!['package','custom'].includes(mode)||!isUuid(key)||!/^[a-f0-9]{32}$/.test(hash)||!getWiseManualDetails())return new Response('Controleer je samenstelling en aanvaard de voorwaarden.',{status:400});
  const signedIn=isCustomerAccount(locals.currentUser);if(signedIn)form.set('email',locals.currentUser!.email);
  const contact=parseBuyer(form),ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(!await rateLimitSupport('checkout-ip',ip,15,3600)||!await rateLimitSupport('checkout-email',contact.email,8,3600))return new Response('Te veel aanvragen. Probeer later opnieuw.',{status:429,headers:privateHeaders});
  const db=getSupabaseAdmin();let result;
  const owner=await purchaseOwner(cookies,locals.currentUser);
  if(owner){const owned=await purchasedProducts(owner);if(owned.some(p=>['module','guide'].includes(p.product_type)&&ids.includes(p.product_id)))return new Response(null,{status:303,headers:{...privateHeaders,location:'/aankopen'}});}
  if(signedIn){
   result=await db.rpc('create_account_checkout',{p_customer:locals.currentUser!.sub,p_ids:ids,p_mode:mode,p_hash:hash,p_submission:key,p_contact:contact});
  }else{
   const checkout=cookies.get(CHECKOUT_COOKIE)?.value;if(!tokenValid(checkout))return new Response('Open je besteloverzicht opnieuw en probeer nogmaals.',{status:400,headers:privateHeaders});
   result=await db.rpc('create_guest_catalog_order',{p_checkout:digest(checkout),p_ids:ids,p_mode:mode,p_hash:hash,p_submission:key,p_contact:contact});
  }
  if(result.error?.message.includes('invalid_profile_age'))return new Response('Dit profiel is bedoeld vanaf 8 jaar. Controleer de geboortedatum van de deelnemer.',{status:400,headers:privateHeaders});
  if(result.error?.message.includes('submission_conflict'))return new Response('Deze bestelling werd al ingediend met andere gegevens. Open een nieuw besteloverzicht.',{status:409,headers:privateHeaders});
  if(result.error?.message.includes('module_already_owned'))return Response.redirect(new URL('/aankopen',request.url),303);
  if(result.error?.message.includes('module_pending_order'))return Response.redirect(new URL('/aankopen',request.url),303);
  if(result.error){return Response.redirect(new URL(`/bestellen?${mode==='package'?'pakket':'producten'}=${ids.join(',')}&melding=gewijzigd`,request.url),303);}
  await deliverCommerceMail(2,String(result.data)).catch(()=>undefined);
  return new Response(null,{status:303,headers:{...privateHeaders,location:`/bestellen?order=${result.data}`}});
 }catch(e){return new Response(e instanceof Error&&e.message==='invalid_contact'?'Controleer naam, e-mail, geboortedatum en geslacht. Gebruik Terug om te corrigeren.':'Je bestelling kon niet worden aangemaakt. Probeer opnieuw.',{status:e instanceof Error&&e.message==='invalid_contact'?400:503,headers:privateHeaders});}
};
