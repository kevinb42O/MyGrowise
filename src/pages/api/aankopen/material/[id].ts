import type {APIRoute} from 'astro';
import {purchaseOwner,hasPurchase,privateHeaders} from '../../../../lib/commerce/purchases';
import {publishedModuleAsset,signedMaterial} from '../../../../lib/modules/server';
import {isUuid} from '../../../../lib/catalog/pricing';
import {trackKeyValid} from '../../../../lib/modules/validation';
export const GET:APIRoute=async({params,url,cookies,locals})=>{
 try{const owner=await purchaseOwner(cookies,locals.currentUser);if(!owner)return new Response('Open eerst je aankooplink.',{status:401,headers:privateHeaders});
  const key=url.searchParams.get('audio');if(!isUuid(params.id)||key!==null&&!trackKeyValid(key)||!await hasPurchase(owner,params.id))return new Response('Niet beschikbaar.',{status:404,headers:privateHeaders});
  const asset=await publishedModuleAsset(params.id,key||undefined);if(!asset)return new Response('Niet beschikbaar.',{status:404,headers:privateHeaders});
  const location=await signedMaterial(asset,url.searchParams.has('download'));
  return key?Response.json({url:location},{headers:privateHeaders}):new Response(null,{status:303,headers:{...privateHeaders,location}});
 }catch{return new Response('Materiaal tijdelijk niet bereikbaar.',{status:503,headers:privateHeaders});}
};
