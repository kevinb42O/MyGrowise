import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../lib/adminAuth';
import {rateLimitSupport} from '../../../lib/supportMail';
import {purchaseOwner,purchaseOrders,privateHeaders} from '../../../lib/commerce/purchases';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {issueBookCode} from '../../../lib/ebooks/server';
import {BOOK_SLUG,BOOK_LIBRARY_PATH} from '../../../lib/ebooks/book';
import {sendWebsiteEmail} from '../../../lib/commerce/websiteMail';
import {SITE_ORIGIN} from '../../../lib/site';
import {renderEmail} from '../../../lib/emailTemplate';
export const POST:APIRoute=async({request,cookies,locals})=>{
 if(!isTrustedFormOrigin(request))return new Response('Geen toegang.',{status:403,headers:privateHeaders});
 const redirect=(suffix:string)=>new Response(null,{status:303,headers:{...privateHeaders,location:BOOK_LIBRARY_PATH+suffix}});
 try{
  const owner=await purchaseOwner(cookies,locals.currentUser);if(!owner)return new Response('Open eerst je aankooptoegang.',{status:401,headers:privateHeaders});
  const paid=(await purchaseOrders(owner)).filter(o=>['paid','fulfilled'].includes(o.status)).map(o=>o.id);if(!paid.length)return new Response('Niet beschikbaar.',{status:404,headers:privateHeaders});
  const db=getSupabaseAdmin();const {data:items,error}=await db.from('order_items').select('id,orders!inner(contact_snapshot,commerce_buyers!orders_buyer_id_fkey(email))').in('order_id',paid).eq('product_slug',BOOK_SLUG).limit(1);
  const item=items?.[0] as any;if(error||!item)return new Response('Niet beschikbaar.',{status:404,headers:privateHeaders});
  const {data:license}=await db.from('ebook_licenses').select('activated_at').eq('order_item_id',item.id).maybeSingle();if(license?.activated_at)return redirect('');
  const email=item.orders.contact_snapshot?.email||item.orders.commerce_buyers?.email;if(!email)throw new Error('contact_missing');
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(!await rateLimitSupport('ebook-code-email',email,3,3600)||!await rateLimitSupport('ebook-code-ip',ip,6,3600))return new Response('Te veel aanvragen. Probeer later opnieuw.',{status:429,headers:privateHeaders});
  const code=await issueBookCode(item.id);const link=new URL('/boeken/activeren',SITE_ORIGIN).href;
  await sendWebsiteEmail(email,'Jouw activatiecode voor Fien — MyGrowise',`Hier is je persoonlijke activatiecode:\n\n${code}\n\n${link}\n\nDe code werkt één keer. Daarna blijft je boek beschikbaar via Mijn aankopen.\n\nMyGrowise`,undefined,undefined,renderEmail({title:'Jouw boek staat klaar.',preheader:'Activeer je e-book met je persoonlijke code.',paragraphs:['Gebruik deze code om jouw e-book te activeren.'],details:[['Activatiecode',code]],action:{label:'Activeer mijn boek',url:link},note:'Je code werkt één keer. Je boek blijft daarna via Mijn aankopen beschikbaar.'}));
  return redirect('?sent=1');
 }catch{return redirect('?error=mail');}
};
