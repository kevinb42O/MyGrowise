import type {APIRoute} from 'astro';
import {isTrustedFormOrigin,isCustomerAccount} from '../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
import {PURCHASE_COOKIE,digest,tokenValid,privateHeaders} from '../../../lib/commerce/purchases';
export const POST:APIRoute=async({request,cookies,locals})=>{
 if(!isTrustedFormOrigin(request)||!isCustomerAccount(locals.currentUser)||!locals.currentUser!.emailConfirmed)return new Response('Log eerst in met een bevestigd klantaccount.',{status:403,headers:privateHeaders});
 const token=cookies.get(PURCHASE_COOKIE)?.value;if(!tokenValid(token))return new Response('Open eerst de link in je aankoopmail.',{status:403,headers:privateHeaders});
 const {error}=await getSupabaseAdmin().rpc('link_guest_purchases',{p_user:locals.currentUser!.sub,p_session:digest(token)});
 return new Response(null,{status:303,headers:{...privateHeaders,location:error?'/aankopen?error=link':'/account/bibliotheek'}});
};
