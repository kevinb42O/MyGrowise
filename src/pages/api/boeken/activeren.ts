import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../lib/adminAuth';
import {rateLimitSupport} from '../../../lib/supportMail';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {normalizeBookCode,ebookDestination,BOOK_SESSION_COOKIE} from '../../../lib/ebooks/server';
import {digest,secret,purchaseCookieOptions,privateHeaders} from '../../../lib/commerce/purchases';
export const POST:APIRoute=async({request,cookies,url})=>{
 if(!isTrustedFormOrigin(request))return new Response('Geen toegang.',{status:403,headers:privateHeaders});
 const fail=()=>new Response(null,{status:303,headers:{...privateHeaders,location:'/boeken/activeren?error=code'}});
 try{
  if(Number(request.headers.get('content-length')||0)>2000)return fail();
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  if(!await rateLimitSupport('ebook-activate',ip,15,3600))return new Response('Te veel pogingen. Probeer later opnieuw.',{status:429,headers:privateHeaders});
  const code=normalizeBookCode((await request.formData()).get('code'));if(!code)return fail();
  const session=secret();const {data,error}=await getSupabaseAdmin().rpc('activate_ebook_code',{p_hash:digest(code),p_session:digest(session)});
  if(error||typeof data!=='string'||!data)return fail();
  cookies.set(BOOK_SESSION_COOKIE,session,purchaseCookieOptions(url.protocol==='https:'));
  return new Response(null,{status:303,headers:{...privateHeaders,location:ebookDestination(data)}});
 }catch{return fail();}
};
