import {getSupabaseAdmin} from './supabase/server';
import {fail,listOffers} from './appointmentCatalog';
import {isTrustedFormOrigin,type UserSession} from './adminAuth';
import {listPatientRecords, getPatientReference} from './clientRecords';
import {fromBrusselsLocalInput} from './brusselsTime';
import {deliverBookingMail} from './bookingMail';
import {createStaffBooking,rescheduleStaffBooking,updateBookingStatus,type BookingStatus} from './practiceStore';
import {ExternalCalendarUnavailableError} from './mijndiadSync';
export async function loadAppointmentPage(context:{request:Request;locals:{currentUser?:UserSession;requestId?:string};params:Record<string,string|undefined>;url:URL;redirect:(url:string,status?:number)=>Response}){
 const user=context.locals.currentUser!,db=getSupabaseAdmin(),id=context.params.id||'';
 const manager=user.roles.includes('super_admin')||user.practiceManager===true;
 const practice=context.url.pathname.startsWith('/praktijk');
 const base=practice?'/praktijk/afspraken':'/admin/afspraken';
 const record=id==='nieuw'?null:await db.from('bookings').select('id,practitioner_id,patient_id,client_name,client_email,starts_at,ends_at,status,appointment_name,channel,location,practitioners(name,user_id)').eq('id',id).maybeSingle();
 if(record)fail(record.error);
 const rawBooking=record?.data;
 const booking=rawBooking?{...rawBooking,practitioners:Array.isArray(rawBooking.practitioners)?rawBooking.practitioners[0]:rawBooking.practitioners}:null;
 if(id!=='nieuw'&&(!booking||(!manager&&booking.practitioners?.user_id!==user.sub)))return new Response('Afspraak niet gevonden.',{status:404});
 const offers=(await listOffers({practitionerId:manager&&!practice?undefined:user.practitionerId||'none'})).filter(o=>o.active);
 let error='';
 if(context.request.method==='POST'){
 if(!isTrustedFormOrigin(context.request))return new Response('Geen toegang.',{status:403});
 try{const form=await context.request.formData(),operation=String(form.get('operation')||'');
 if(id==='nieuw'){
 const offer=offers.find(o=>o.id===form.get('offer_id'));if(!offer)throw new Error('Kies een geldig afspraaktype.');
 const data=await createStaffBooking(offer.practitionerId,user.sub,String(form.get('patient_id')||''),fromBrusselsLocalInput(String(form.get('starts_at')||'')),offer.id,context.locals.requestId);
 try{await deliverBookingMail(1,String(data));}catch{}
 return context.redirect(`${base}/${data}?opgeslagen=1`,303);
 }
 if(operation==='reschedule'){
 await rescheduleStaffBooking(id,user.sub,fromBrusselsLocalInput(String(form.get('starts_at')||'')),booking!.ends_at,context.locals.requestId);
 }else if(operation==='mail'){
 const {error:me}=await db.rpc('retry_booking_mail',{p_actor:user.sub,p_job:String(form.get('job_id')||'')});fail(me);
 }else if(operation==='status'){
 const status=String(form.get('status')||'');if(!['confirmed','declined','cancelled','completed','no_show'].includes(status))throw new Error('Ongeldige status.');
 await updateBookingStatus(id,booking!.practitioner_id,user.sub,status as BookingStatus,context.locals.requestId,context.url.pathname);
 }else throw new Error('Onbekende actie.');
 try{await deliverBookingMail(2,id);}catch{}
 return context.redirect(`${base}/${id}?opgeslagen=1`,303);
 }catch(cause){const message=cause instanceof Error?cause.message:'';error=cause instanceof ExternalCalendarUnavailableError?'De externe agenda kan nu niet worden gecontroleerd. Er is niets gewijzigd; een bestaande afspraak blijft behouden. Probeer later opnieuw.':/23P01|conflict|slot_unavailable/i.test(message)?'Dit tijdstip overlapt met een andere afspraak of blokkade.':'Opslaan is niet gelukt. Controleer je invoer en de huidige status van de afspraak.';}
 }
 const patients=id==='nieuw'?await listPatientRecords(user):[];
 const canViewPatient=booking?.patient_id?Boolean(await getPatientReference(user,booking.patient_id,context.locals.requestId)):false;
 const mail=booking?await db.from('booking_mail_jobs').select('id,kind,status,attempts,last_error,created_at,sent_at').eq('booking_id',id).order('created_at',{ascending:false}):{data:[],error:null};fail(mail.error);
 const history=booking?await db.from('booking_schedule_events').select('id,old_starts_at,new_starts_at,occurred_at').eq('booking_id',id).order('occurred_at',{ascending:false}):{data:[],error:null};fail(history.error);
 return {booking,offers,patients,error,mail:mail.data||[],history:history.data||[],canViewPatient,isNew:id==='nieuw',practice};
}
export type AppointmentPage=Exclude<Awaited<ReturnType<typeof loadAppointmentPage>>,Response>;
