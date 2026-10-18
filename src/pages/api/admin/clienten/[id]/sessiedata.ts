import type {APIRoute} from 'astro';
import {getPatientReference} from '../../../../../lib/clientRecords';
import {getSupabaseAdmin} from '../../../../../lib/supabase/server';
import {fromBrusselsLocalInput} from '../../../../../lib/brusselsTime';
export const prerender=false;
export const GET:APIRoute=async({locals,params,url})=>{
 const patient=await getPatientReference(locals.currentUser!,params.id||'',locals.requestId);
 if(!patient)return new Response('Dossier niet gevonden.',{status:404});
 const from=url.searchParams.get('van')||'',to=url.searchParams.get('tot')||'';
 if([from,to].some(v=>v&&!/^\d{4}-\d{2}-\d{2}$/.test(v)))return new Response('Ongeldige periode.',{status:400});
 const rows:string[]=[`Uitgevoerde sessies — ${patient.fullName}`,''];
 for(let offset=0;;offset+=1000){
 let query=getSupabaseAdmin().from('bookings').select('id,starts_at,appointment_name,practitioners(name)').eq('patient_id',patient.id).eq('status','completed').order('starts_at').order('id').range(offset,offset+999);
 if(from)query=query.gte('starts_at',fromBrusselsLocalInput(`${from}T00:00`));
 if(to)query=query.lt('starts_at',fromBrusselsLocalInput(`${new Date(Date.parse(`${to}T12:00:00Z`)+86400000).toISOString().slice(0,10)}T00:00`));
 const {data,error}=await query;if(error)return new Response('Sessiedata konden niet worden geladen.',{status:503});
 rows.push(...(data||[]).map((b:any)=>`${new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',dateStyle:'medium',timeStyle:'short'}).format(new Date(b.starts_at))} — ${b.appointment_name} — ${b.practitioners?.name||'Therapeut'}`));
 if(!data||data.length<1000)break;
 }
 return new Response(rows.join('\n'),{headers:{'content-type':'text/plain; charset=utf-8','content-disposition':'attachment; filename="sessiedata.txt"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
};
