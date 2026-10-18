import type {APIRoute} from 'astro';
import {accessibleModuleAsset,signedMaterial} from '../../../../../../lib/modules/server';
import {isUuid} from '../../../../../../lib/catalog/pricing';
import {trackKeyValid} from '../../../../../../lib/modules/validation';
export const GET:APIRoute=async({params,locals})=>{
 const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer'};
 try{if(!isUuid(params.productId)||!trackKeyValid(params.trackKey))return new Response('Niet beschikbaar.',{status:404,headers});const a=await accessibleModuleAsset(locals.currentUser!.sub,params.productId,params.trackKey);if(!a)return new Response('Niet beschikbaar.',{status:404,headers});return Response.json({url:await signedMaterial(a)},{headers});}catch{return new Response('Audio tijdelijk niet beschikbaar.',{status:503,headers});}
};
