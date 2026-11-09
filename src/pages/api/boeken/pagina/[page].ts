import type {APIRoute} from 'astro';
import {privateHeaders} from '../../../../lib/commerce/purchases';
import {canReadBook} from '../../../../lib/ebooks/server';
import {signR2BookUrl} from '../../../../lib/ebooks/r2';

export const GET:APIRoute=async({params,cookies,locals})=>{
 const page=params.page||'';
 if(!/^(0[1-9]|1[0-9]|2[0-9])$/.test(page))return new Response(null,{status:404,headers:privateHeaders});
 try{
  if(!await canReadBook(cookies,locals.currentUser))return new Response(null,{status:401,headers:privateHeaders});
  const location=signR2BookUrl(`fien-reader-r1/${page}.webp`,false);
  return new Response(null,{status:302,headers:{...privateHeaders,location}});
 }catch{return new Response(null,{status:503,headers:privateHeaders});}
};
