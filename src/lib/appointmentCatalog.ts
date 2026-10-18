import {getSupabaseAdmin} from './supabase/server';
import {ensurePracticeCalendarFresh} from './mijndiadSync';
export type Offer = {id:string;practitionerId:string;practitionerName:string;practitionerSlug:string;typeId:string;name:string;slug:string;color:string;groupId:string;groupName:string;kind:string;channel:string;location:string;duration:number;active:boolean;bookable:boolean;instructions:string};
export const fail = (error: {message?:string}|null) => {if(error) throw new Error(error.message||'database_error');};
export const listOffers = async (options:{practitionerId?:string;publicOnly?:boolean}={}):Promise<Offer[]> => {
 let query=getSupabaseAdmin().from('practitioner_appointment_types').select('*,appointment_types!inner(*,treatment_groups!inner(*)),practitioners!inner(id,name,slug,active,online_instructions,practitioner_settings(requests_enabled))').order('id');
 if(options.practitionerId) query=query.eq('practitioner_id',options.practitionerId);
 const data:any[]=[];
 for(let offset=0;;offset+=500){const result=await query.range(offset,offset+499);fail(result.error);data.push(...(result.data||[]));if(!result.data||result.data.length<500)break;}
 return data.filter((r:any)=>!options.publicOnly||(r.active&&r.bookable&&r.appointment_types.active&&r.practitioners.active&&(Array.isArray(r.practitioners.practitioner_settings)?r.practitioners.practitioner_settings[0]:r.practitioners.practitioner_settings)?.requests_enabled)).map((r:any)=>{
 const t=r.appointment_types,g=t.treatment_groups,p=r.practitioners;
 return {id:r.id,practitionerId:p.id,practitionerName:p.name,practitionerSlug:p.slug,typeId:t.id,name:t.name,slug:t.slug,color:g.color,groupId:g.id,groupName:g.name,kind:t.session_kind,channel:t.channel,location:t.location,duration:r.duration_minutes??t.duration_minutes,active:r.active&&t.active&&p.active,bookable:r.bookable,instructions:p.online_instructions};
 }).sort((a:Offer,b:Offer)=>a.name.localeCompare(b.name,'nl'));
};
export const getOfferSlots=async(offer:Offer,days=90,limit?:number)=>{
 await ensurePracticeCalendarFresh(offer.practitionerId);
 const rows:{startsAt:string;endsAt:string}[]=[];
 for(let offset=0;;offset+=500){
 const {data,error}=await getSupabaseAdmin().rpc('get_offer_slots',{p_offer:offer.id,p_days:days}).range(offset,limit?Math.min(offset+499,limit-1):offset+499);fail(error);
 rows.push(...(data||[]).map((r:any)=>({startsAt:String(r.starts_at),endsAt:String(r.ends_at)})));
 if(!data||data.length<500||(limit&&rows.length>=limit))break;
 }
 return rows;
};
export const listPublicPractitioners=async()=>{
 const {data,error}=await getSupabaseAdmin().from('practitioners').select('id,slug,name,public_role,bio,expertise,languages,image_url').eq('active',true).order('name');fail(error);return data||[];
};
export const bookingPath=(offer:Pick<Offer,'id'>)=>`/afspraak/${offer.id}`;
