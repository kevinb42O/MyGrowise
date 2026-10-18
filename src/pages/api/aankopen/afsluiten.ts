import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {PURCHASE_COOKIE,digest,tokenValid,privateHeaders} from '../../../lib/commerce/purchases';
export const POST:APIRoute=async({request,cookies})=>{
 if(!isTrustedFormOrigin(request))return new Response('Geen toegang.',{status:403,headers:privateHeaders});
 const token=cookies.get(PURCHASE_COOKIE)?.value;
 if(tokenValid(token)){
  const {error}=await getSupabaseAdmin().from('commerce_sessions').delete().eq('session_hash',digest(token));
  if(error)return new Response('Afsluiten is tijdelijk niet gelukt. Probeer opnieuw.',{status:503,headers:privateHeaders});
 }
 cookies.delete(PURCHASE_COOKIE,{path:'/'});
 return new Response(null,{status:303,headers:{...privateHeaders,location:'/aankopen/toegang'}});
};
