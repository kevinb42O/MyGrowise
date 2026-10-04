import type { APIRoute } from 'astro';
import {quoteCatalog} from '../../../lib/catalog/server';
export const GET: APIRoute=async({url})=>{try{const ids=(url.searchParams.get('ids')||'').split(',');const quote=await quoteCatalog(ids,url.searchParams.get('mode')||'custom');return Response.json(quote,{headers:{'cache-control':'no-store'}});}catch{return Response.json({error:'Deze samenstelling is niet beschikbaar. Bekijk het aanbod opnieuw.'},{status:422,headers:{'cache-control':'no-store'}});}};
