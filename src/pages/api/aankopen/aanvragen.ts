import {waitUntil} from '@vercel/functions';
import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {rateLimitSupport} from '../../../lib/supportMail';
import {purchaseNext,privateHeaders} from '../../../lib/commerce/purchases';
import {queueWebsiteMail,deliverWebsiteMail} from '../../../lib/commerce/websiteMail';
export const POST:APIRoute=async({request})=>{
 if(!isTrustedFormOrigin(request))return new Response('Geen toegang.',{status:403});
 const f=await request.formData();const email=String(f.get('email')||'').trim().toLowerCase(),next=purchaseNext(f.get('next'));
 try{const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&await rateLimitSupport('purchase-access-ip',ip,10,3600)&&await rateLimitSupport('purchase-access-email',email,4,3600)){
   await queueWebsiteMail('purchase_access',{email,next});
   waitUntil(deliverWebsiteMail(5).catch(()=>undefined));
  }
 }catch{/* Neutral response never reveals whether an address has bought something. */}
 // A queue task is processed by cron; response timing must not reveal existence.
 return new Response(null,{status:303,headers:{...privateHeaders,location:`/aankopen/toegang?sent=1&next=${encodeURIComponent(next)}`}});
};
