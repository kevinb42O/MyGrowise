import {waitUntil} from '@vercel/functions';
import {isEbook} from '../../../lib/ebooks/book';
import {salesEnabled,salesPausedMessage} from '../../../lib/commerce/readiness';
import {deliverCommerceMail} from '../../../lib/catalog/mail';
import {quoteCatalog} from '../../../lib/catalog/server';
import {digitalContentItems,digitalDeliveryStatement,termsRevision,termsForEmail} from '../../../lib/commerce/terms';
import type {APIRoute} from 'astro';
import {isTrustedFormOrigin,isCustomerAccount} from '../../../lib/adminAuth';
import {isUuid} from '../../../lib/catalog/pricing';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {getWiseManualDetails} from '../../../lib/wiseCheckout';
import {rateLimitSupport} from '../../../lib/supportMail';
import {CHECKOUT_COOKIE,digest,tokenValid,parseBuyer,privateHeaders,purchaseOwner,purchasedProducts} from '../../../lib/commerce/purchases';
export const POST:APIRoute=async({request,locals,cookies})=>{
 const json=request.headers.get('accept')?.includes('application/json');
 const fail=(message:string,status=400)=>new Response(json?JSON.stringify({error:message}):message,{status,headers:{...privateHeaders,'content-type':json?'application/json; charset=utf-8':'text/plain; charset=utf-8'}});
 const go=(location:string)=>json?new Response(JSON.stringify({location}),{headers:{...privateHeaders,'content-type':'application/json; charset=utf-8'}}):new Response(null,{status:303,headers:{...privateHeaders,location}});
 let bookOnly=false;
 if(!isTrustedFormOrigin(request))return fail('Je sessie kon niet worden gecontroleerd. Vernieuw de pagina en probeer opnieuw.',403);
 if(!salesEnabled())return fail(salesPausedMessage,503);
 if(Number(request.headers.get('content-length')||0)>16000)return fail('Je aanvraag is te groot. Vernieuw de pagina en probeer opnieuw.',413);
 try{
  const form=await request.formData(),ids=String(form.get('ids')||'').split(','),mode=String(form.get('mode')||''),key=String(form.get('submission')||''),hash=String(form.get('hash')||'');
  if(form.get('website'))return fail('Controleer je gegevens.');
  if(form.get('terms')!=='accepted'||!ids.length||ids.length>30||ids.some(x=>!isUuid(x))||!['package','custom'].includes(mode)||!isUuid(key)||!/^[a-f0-9]{32}$/.test(hash)||!getWiseManualDetails())return fail('Controleer je keuze en ga akkoord met de voorwaarden. Zijn de betaalgegevens niet beschikbaar? Probeer later opnieuw.');
  const signedIn=isCustomerAccount(locals.currentUser);if(signedIn)form.set('email',locals.currentUser!.email);
  const quote=await quoteCatalog(ids,mode);
  bookOnly=quote.items.length===1&&isEbook(quote.items[0]);
  const buyer=parseBuyer(form,bookOnly),ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(!await rateLimitSupport('checkout-ip',ip,15,3600)||!await rateLimitSupport('checkout-email',buyer.email,8,3600))return fail('Je hebt te vaak geprobeerd te bestellen. Wacht een uur of neem contact op als je bestelling al ontvangen is.',429);
  const digitalItems=digitalContentItems(quote.items);
  if(digitalItems.length&&form.get('digital_delivery')!=='accepted')return fail('Bevestig ook de afzonderlijke toestemming voor digitale levering.');
  const contact={...buyer,terms_revision:termsRevision,terms_text:termsForEmail(),...(digitalItems.length?{digital_delivery_consent:{revision:termsRevision,statement:digitalDeliveryStatement,product_ids:digitalItems.map(item=>item.id).sort()}}:{})};
  const db=getSupabaseAdmin();let result;
  const owner=await purchaseOwner(cookies,locals.currentUser);
  if(owner){const owned=await purchasedProducts(owner);if(owned.some(p=>['module','guide'].includes(p.product_type)&&ids.includes(p.product_id)))return go('/aankopen');}
  if(signedIn){
   result=await db.rpc('create_account_checkout',{p_customer:locals.currentUser!.sub,p_ids:ids,p_mode:mode,p_hash:hash,p_submission:key,p_contact:contact});
  }else{
   const checkout=cookies.get(CHECKOUT_COOKIE)?.value;if(!tokenValid(checkout))return fail('Je bestelsessie is verlopen. Vernieuw de pagina en probeer opnieuw.');
   result=await db.rpc('create_guest_catalog_order',{p_checkout:digest(checkout),p_ids:ids,p_mode:mode,p_hash:hash,p_submission:key,p_contact:contact});
  }
  if(result.error?.message.includes('invalid_profile_age'))return fail('Dit profiel is bedoeld vanaf 8 jaar. Controleer de geboortedatum van de deelnemer.');
  if(result.error?.message.includes('submission_conflict'))return fail('Deze bestelling is al ontvangen met andere gegevens. Controleer je bestelmail voordat je opnieuw bestelt. Neem contact op als je iets wilt corrigeren.',409);
  if(result.error?.message.includes('module_already_owned'))return go('/aankopen');
  if(result.error?.message.includes('module_pending_order'))return go('/aankopen');
  if(result.error?.message.includes('quote_changed')||result.error?.message.includes('unavailable_product'))return fail('De prijs of beschikbaarheid is gewijzigd. Vernieuw de pagina en controleer je bestelling opnieuw.',409);
  if(result.error)return fail('Je bestelling kon tijdelijk niet worden opgeslagen. Je gegevens blijven hieronder staan. Probeer opnieuw met dezelfde knop.',503);
  // The order and mail job are already durable; SMTP must not hold the checkout open.
  waitUntil(deliverCommerceMail(2,String(result.data)).catch(()=>undefined));
  return go(`/bestellen?order=${result.data}`);
 }catch(e){
  const invalid=e instanceof Error&&e.message==='invalid_contact';
  return fail(invalid?(bookOnly?'Controleer je voornaam, achternaam en e-mailadres.':'Controleer de naam, het e-mailadres, de geboortedatum en het geslacht.'):'Je bestelling kon tijdelijk niet worden verwerkt. Probeer opnieuw met dezelfde knop. Heb je al een bestelmail ontvangen? Open dan die bestelling.',invalid?400:503);
 }
};
