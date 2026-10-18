import {getSupabaseAdmin} from './supabase/server';
import {fail} from './appointmentCatalog';
export async function loadPracticeManagement(){
 const db=getSupabaseAdmin();
 const results=await Promise.all([db.from('appointment_types').select('*').order('name'),db.from('treatment_groups').select('*').order('name'),db.from('practitioner_appointment_types').select('*'),db.from('practitioners').select('*,practitioner_settings(*)').order('name'),db.from('availability_rules').select('practitioner_id,weekday,start_time,end_time').order('weekday'),db.from('user_roles').select('user_id,role').in('role',['employee','practitioner','super_admin'])]);
 results.forEach(r=>fail(r.error));
 const ids=[...new Set((results[5].data||[]).map((r:any)=>r.user_id))];
 const staff=ids.length?await db.from('profiles').select('id,full_name').in('id',ids):{data:[],error:null};fail(staff.error);
 return {types:results[0].data||[],groups:results[1].data||[],offers:results[2].data||[],practitioners:results[3].data||[],rules:results[4].data||[],staff:staff.data||[]};
}
export function appointmentTypeInput(form:FormData){
 const name=String(form.get('name')||'').trim(),color=String(form.get('color')||'');
 const duration=Number(form.get('duration_minutes'));
 if(name.length<2||name.length>120||!/^#[0-9a-f]{6}$/i.test(color)||!Number.isInteger(duration)||duration<15||duration>240||duration%5)throw new Error('Controleer naam, kleur en duur (15–240 minuten, in stappen van 5).');
 return {id:String(form.get('id')||''),name,color,group_id:String(form.get('group_id')||''),group_name:String(form.get('group_name')||''),session_kind:String(form.get('session_kind')),channel:String(form.get('channel')),location:String(form.get('location')||'').trim(),duration_minutes:duration,active:form.has('active'),offers:form.getAll('practitioner_id').map(id=>({practitioner_id:String(id),duration_minutes:String(form.get(`duration_${id}`)||''),bookable:form.has(`bookable_${id}`)}))};
}
