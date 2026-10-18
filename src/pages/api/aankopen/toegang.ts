import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../lib/adminAuth';
import {rateLimitSupport} from '../../../lib/supportMail';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {secret,digest,tokenValid,purchaseNext,PURCHASE_COOKIE,purchaseCookieOptions,privateHeaders} from '../../../lib/commerce/purchases';
export const POST:APIRoute=async({request,cookies,url})=>{
 if(!isTrustedFormOrigin(request))return new Response('Geen toegang.',{status:403});
 const f=await request.formData(),token=f.get('token'),session=secret();
 try{if(!tokenValid(token)||!await rateLimitSupport('purchase-consume',request.headers.get('x-forwarded-for')||'unknown',20,3600))throw new Error('invalid_token');
  const {data,error}=await getSupabaseAdmin().rpc('consume_purchase_token',{p_token:digest(token),p_session:digest(session)});if(error||data!==true)throw new Error('invalid_token');
  cookies.set(PURCHASE_COOKIE,session,purchaseCookieOptions(url.protocol==='https:'));
  return new Response(null,{status:303,headers:{...privateHeaders,location:purchaseNext(f.get('next'))}});
 }catch{return new Response(null,{status:303,headers:{...privateHeaders,location:'/aankopen/toegang?error=expired'}});}
};
