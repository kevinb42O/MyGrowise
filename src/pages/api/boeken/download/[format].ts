import type {APIRoute} from 'astro';
import {purchaseOwner,privateHeaders} from '../../../../lib/commerce/purchases';
import {ebookProduct,ebookActivated,ebookDownload,hasBookSession} from '../../../../lib/ebooks/server';
export const GET:APIRoute=async({params,url,cookies,locals})=>{
 try{
  if(params.format!=='pdf'&&params.format!=='epub')return new Response('Niet beschikbaar.',{status:404,headers:privateHeaders});
  const owner=await purchaseOwner(cookies,locals.currentUser);
  const product=await ebookProduct();
  const allowed=product&&(await hasBookSession(cookies,product.id)||(owner&&await ebookActivated(owner,product.id)));
  if(!allowed||!product)return new Response('Niet beschikbaar.',{status:owner?404:401,headers:privateHeaders});
  return new Response(null,{status:303,headers:{...privateHeaders,location:await ebookDownload(product.id,params.format,!url.searchParams.has('open'))}});
 }catch{return new Response('Het boek is tijdelijk niet bereikbaar. Probeer later opnieuw.',{status:503,headers:privateHeaders});}
};
