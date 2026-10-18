import type {APIRoute} from 'astro';
import {purchaseOwner,purchaseDeliveries,privateHeaders} from '../../../lib/commerce/purchases';
import {getSupabaseAdmin} from '../../../lib/supabase/server';
export const GET:APIRoute=async({url,cookies,locals})=>{
 try{const owner=await purchaseOwner(cookies,locals.currentUser);if(!owner)return new Response('Open eerst je aankooplink.',{status:401,headers:privateHeaders});
  const d=(await purchaseDeliveries(owner)).find(d=>d.id===url.searchParams.get('id'));if(!d?.report_path)return new Response('Niet beschikbaar.',{status:404,headers:privateHeaders});
  const {data,error}=await getSupabaseAdmin().storage.from('assessment-reports').createSignedUrl(d.report_path,60,{download:'MyGrowise-rapport.pdf'});if(error||!data)throw new Error('storage');return new Response(null,{status:303,headers:{...privateHeaders,location:data.signedUrl}});
 }catch{return new Response('Rapport tijdelijk niet bereikbaar.',{status:503,headers:privateHeaders});}
};
