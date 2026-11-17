import type { APIRoute } from 'astro';
import { deliverBookingMail } from '../../../lib/bookingMail';
export const prerender=false;
const authorized=(request:Request)=>Boolean(import.meta.env.CRON_SECRET?.trim() && request.headers.get('authorization')===`Bearer ${import.meta.env.CRON_SECRET.trim()}`);
export const HEAD:APIRoute=async({request})=>new Response(null,{status:authorized(request)?204:401,headers:{'cache-control':'no-store'}});
export const GET:APIRoute=async({request})=>{
 if(!authorized(request))return new Response('Geen toegang.',{status:401});
 try{return Response.json(await deliverBookingMail(100),{headers:{'cache-control':'no-store'}});}
 catch{return new Response('Verzending tijdelijk niet beschikbaar.',{status:503});}
};
export const ALL:APIRoute=()=>new Response('Methode niet toegestaan.',{status:405});
