import {getSupabaseAdmin} from './supabase/server';
import {parsePatientDetails} from './patientDetails';
import type {UserSession} from './adminAuth';
import {isCustomerAccount} from './adminAuth';
import {fail} from './appointmentCatalog';
import {ensurePracticeCalendarFresh, ExternalCalendarUnavailableError} from './mijndiadSync';
export const bookAppointment=async(user:UserSession,offerId:string,form:FormData,requestId?:string)=>{
 if(!isCustomerAccount(user)||!user.emailConfirmed) throw new Error('Meld je aan met een bevestigd cliëntaccount om te boeken.');
 const details=parsePatientDetails(Object.fromEntries(form.entries()),true);
 const key=String(form.get('submission_key')||''),starts=String(form.get('starts_at')||'');
 if(!/^[0-9a-f-]{36}$/i.test(key)||!Number.isFinite(Date.parse(starts))) throw new Error('Kies een beschikbaar moment.');
 const {data:offer,error:offerError}=await getSupabaseAdmin().from('practitioner_appointment_types').select('practitioner_id').eq('id',offerId).maybeSingle();
 fail(offerError);
 if(!offer)throw new Error('Dit afspraaktype is niet meer boekbaar.');
 await ensurePracticeCalendarFresh(offer.practitioner_id,{maxAgeSeconds:60});
 const {data,error}=await getSupabaseAdmin().rpc('book_customer_appointment',{p_customer:user.sub,p_offer:offerId,p_starts:starts,p_key:key,p_details:details,p_request:requestId||null});
 if(error){
  const code=error.message;
  if(/external_calendar_unavailable/.test(code)) throw new ExternalCalendarUnavailableError();
  if(error.code==='23P01') throw new Error('Dit moment is intussen bezet. Kies een ander tijdstip.');
  if(/identity_review_required|patient_archived/.test(code)) throw new Error('Je bestaande dossier moet eerst door de praktijk worden nagekeken. Neem contact op met de praktijk.');
  if(/rate_limited/.test(code)) throw new Error('Je hebt kort na elkaar meerdere afspraken geboekt. Wacht even voordat je opnieuw boekt.');
  if(/offer_unavailable/.test(code)) throw new Error('Dit afspraaktype is niet meer boekbaar.');
  throw new Error('De afspraak kon niet worden opgeslagen. Controleer je gegevens en probeer opnieuw.');
 }
 return String(data);
};
export const customerDetails=async(user:UserSession)=>{
 if(!isCustomerAccount(user)) return {};
 const {data,error}=await getSupabaseAdmin().from('patients').select('first_name,last_name,birth_date,gender,salutation,street,house_number,address_box,postal_code,city,country,mobile,registration_reason,referrer').eq('customer_user_id',user.sub).maybeSingle();fail(error);return data||{};
};
