import type {APIRoute} from 'astro';
import {getDelivery} from '../../../../../lib/catalog/server';
import {getSupabaseAdmin} from '../../../../../lib/supabase/server';
export const GET:APIRoute=async({params,locals})=>{
 const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer'};
 try{const delivery=await getDelivery(params.id||'',locals.currentUser!.sub);if(!delivery?.report_path)return new Response('Rapport niet beschikbaar.',{status:404,headers});
 const {data,error}=await getSupabaseAdmin().storage.from('assessment-reports').createSignedUrl(delivery.report_path,60,{download:'MyGrowise-rapport.pdf'});if(error||!data)return new Response('Rapport tijdelijk niet beschikbaar.',{status:503,headers});return new Response(null,{status:303,headers:{...headers,location:data.signedUrl}});
 }catch{return new Response('Rapport tijdelijk niet beschikbaar.',{status:503,headers});}
};
