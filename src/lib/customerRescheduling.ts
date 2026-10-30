import {getSupabaseAdmin} from './supabase/server';
import {isCustomerAccount,type UserSession} from './adminAuth';
import {ensurePracticeCalendarFresh,ExternalCalendarUnavailableError} from './mijndiadSync';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requireCustomer = (user:UserSession) => {
  if (!isCustomerAccount(user) || !user.emailConfirmed) throw new Error('Meld je aan met een bevestigd cliëntaccount om je afspraak te verplaatsen.');
};
export const customerRescheduleBooking = async (user:UserSession,id:string) => {
  requireCustomer(user);
  if (!uuid.test(id)) return null;
  const {data,error}=await getSupabaseAdmin().from('bookings')
    .select('id,practitioner_id,appointment_name,starts_at,ends_at,status,channel,location,practitioners(name)')
    .eq('id',id).eq('customer_user_id',user.sub).maybeSingle();
  if (error) throw new Error('Je afspraak kan nu niet worden opgehaald. Probeer later opnieuw.');
  if (!data) return null;
  const practitioner=Array.isArray(data.practitioners)?data.practitioners[0]:data.practitioners;
  return {...data,practitionerName:practitioner?.name||'Je professional'};
};
export const customerRescheduleSlots = async (user:UserSession,booking:{id:string;practitioner_id:string}) => {
  requireCustomer(user);
  await ensurePracticeCalendarFresh(booking.practitioner_id,{maxAgeSeconds:60});
  const slots:{startsAt:string;endsAt:string}[]=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await getSupabaseAdmin().rpc('get_customer_reschedule_slots',{p_customer:user.sub,p_booking:booking.id,p_days:90}).range(offset,offset+499);
    if(error) throw new Error('De vrije momenten kunnen nu niet worden opgehaald. Probeer later opnieuw.');
    slots.push(...(data||[]).map((row:{starts_at:string;ends_at:string})=>({startsAt:row.starts_at,endsAt:row.ends_at})));
    if(!data||data.length<500) break;
  }
  return slots;
};
export const rescheduleCustomerAppointment = async (user:UserSession,id:string,form:FormData,requestId?:string) => {
  requireCustomer(user);
  const starts=String(form.get('starts_at')||''),previous=String(form.get('previous_starts_at')||'');
  if(!uuid.test(id)||!Number.isFinite(Date.parse(starts))||!Number.isFinite(Date.parse(previous))) throw new Error('Kies een beschikbaar moment.');
  const booking=await customerRescheduleBooking(user,id);
  if(!booking||booking.status!=='confirmed') throw new Error('Deze afspraak kan niet worden verplaatst. Bekijk je actuele afspraken.');
  await ensurePracticeCalendarFresh(booking.practitioner_id,{maxAgeSeconds:60});
  const {error}=await getSupabaseAdmin().rpc('reschedule_customer_appointment',{
    p_customer:user.sub,p_booking:id,p_starts:starts,p_previous:previous,p_request:requestId||null,
  });
  if(!error) return;
  if(/external_calendar_unavailable/.test(error.message)) throw new ExternalCalendarUnavailableError();
  if(error.code==='23P01') throw new Error('Dit moment is intussen bezet. Kies een ander tijdstip. Je bestaande afspraak blijft behouden.');
  if(error.code==='40001'||error.code==='40P01'||/booking_changed/.test(error.message)) throw new Error('Je afspraak is intussen gewijzigd. Herlaad de pagina voordat je een nieuw moment kiest.');
  if(/reschedule_too_late/.test(error.message)) throw new Error('Je afspraak is te dichtbij om online te verplaatsen. Neem contact op met je professional.');
  if(/reschedule_rate_limited/.test(error.message)) throw new Error('Je hebt je afspraak kort na elkaar meerdere keren verplaatst. Wacht even en probeer opnieuw.');
  throw new Error('Verplaatsen is niet gelukt. Je bestaande afspraak blijft behouden. Probeer opnieuw of neem contact op.');
};
