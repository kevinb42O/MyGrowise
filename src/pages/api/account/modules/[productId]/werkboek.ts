import type {APIRoute} from 'astro';
import {accessibleModuleAsset,signedMaterial} from '../../../../../lib/modules/server';
import {isUuid} from '../../../../../lib/catalog/pricing';
export const GET:APIRoute=async({params,locals,url})=>{
 const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer'};
 try{if(!isUuid(params.productId))return new Response('Niet beschikbaar.',{status:404,headers});const a=await accessibleModuleAsset(locals.currentUser!.sub,params.productId);if(!a)return new Response('Niet beschikbaar.',{status:404,headers});return new Response(null,{status:303,headers:{...headers,location:await signedMaterial(a,url.searchParams.has('download'))}});}catch{return new Response('Bestand tijdelijk niet beschikbaar.',{status:503,headers});}
};
