import type {APIRoute} from 'astro';
import {getPractitionerBySlug} from '../../../lib/practiceStore';
import {listOffers,getOfferSlots,bookingPath} from '../../../lib/appointmentCatalog';
export const prerender=false;
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export const GET:APIRoute=async({params,url})=>{
 try{const person=await getPractitionerBySlug(params.slug||'');
 if(!person?.active)return json({error:'Therapeut niet gevonden.'},404);
 const offers=await listOffers({practitionerId:person.id,publicOnly:true});
 const selected=offers.find(o=>o.id===url.searchParams.get('offer'));
 if(url.searchParams.has('offer')&&!selected)return json({error:'Afspraaktype niet beschikbaar.'},404);
 return json({practitioner:{slug:person.slug,name:person.name},timeZone:'Europe/Brussels',types:offers.map(o=>({id:o.id,name:o.name,durationMinutes:o.duration,url:bookingPath(o)})),...(selected?{offer:selected.id,durationMinutes:selected.duration,slots:await getOfferSlots(selected)}:{})});
 }catch{return json({error:'De agenda is tijdelijk niet bereikbaar. Probeer later opnieuw.'},503);}
};
export const ALL:APIRoute=()=>json({error:'Methode niet toegestaan.'},405);
