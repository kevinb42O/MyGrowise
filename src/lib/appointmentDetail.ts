import {bookNewPatient,registerBookingOutcome} from './staffBooking';
import {getSupabaseAdmin} from './supabase/server';
import {fail,listOffers} from './appointmentCatalog';
import {isTrustedFormOrigin,type UserSession} from './adminAuth';
import {getPatientReference} from './clientRecords';
import {fromBrusselsLocalInput} from './brusselsTime';
import {attemptAgendaBookingMail} from './bookingMail';
import {createStaffBooking,rescheduleStaffBooking,updateBookingStatus,type BookingStatus} from './practiceStore';
import {agendaError, agendaInstant, agendaUuid} from './agendaData';
export async function loadAppointmentPage(context:{request:Request;locals:{currentUser?:UserSession;requestId?:string};params:Record<string,string|undefined>;url:URL;redirect:(url:string,status?:number)=>Response}){
 const user=context.locals.currentUser!,db=getSupabaseAdmin(),id=context.params.id||'';
 const manager=user.roles.includes('super_admin')||user.practiceManager===true;
 const practice=context.url.pathname.startsWith('/praktijk');
 const base=practice?'/praktijk/afspraken':'/admin/afspraken';
 const agenda=practice?'/praktijk/agenda':'/admin/agenda';
 const returnPath=context.url.searchParams.get('return') || '';
 const agendaHref=returnPath.startsWith(agenda+'?') ? agenda+'?'+new URLSearchParams(returnPath.slice(agenda.length+1)) : agenda;
 const savedHref=(bookingId:string,mailStatus:string|null)=>`${base}/${bookingId}?${new URLSearchParams({
   opgeslagen:'1',return:agendaHref,...(mailStatus?{mail:mailStatus}:{}),
 })}`;
 const record=id==='nieuw'?null:await db.from('bookings').select('id,practitioner_id,patient_id,client_name,client_email,starts_at,ends_at,updated_at,status,cancellation_category,no_show_billing,appointment_name,channel,location,practitioners(name,user_id)').eq('id',id).maybeSingle();
 if(record)fail(record.error);
 const rawBooking=record?.data;
 const booking=rawBooking?{...rawBooking,practitioners:Array.isArray(rawBooking.practitioners)?rawBooking.practitioners[0]:rawBooking.practitioners}:null;
 if(id!=='nieuw'&&(!booking||(!manager&&booking.practitioners?.user_id!==user.sub)))return new Response('Afspraak niet gevonden.',{status:404});
 const offers=id==='nieuw' ? (await listOffers({practitionerId:manager&&!practice?undefined:user.practitionerId||'none'})).filter(o=>o.active) : [];
 let error='';
 let submitted:Record<string,string>={};
 if(context.request.method==='POST'){
 if(!isTrustedFormOrigin(context.request))return new Response('Geen toegang.',{status:403});
 try{const form=await context.request.formData(),operation=String(form.get('operation')||'');
 submitted=Object.fromEntries([...form.entries()].map(([key,value])=>[key,String(value)]));
 if(id==='nieuw'){
 const offer=offers.find(o=>o.id===form.get('offer_id'));if(!offer)throw new Error('Kies een geldig afspraaktype.');
 const starts=fromBrusselsLocalInput(String(form.get('starts_at')||''));
 const data=form.get('new_name') ? await bookNewPatient(user.sub,String(form.get('submission_key')||''),String(form.get('new_name')),String(form.get('new_email')||''),offer.id,starts,String(form.get('new_birth_date')||''),context.locals.requestId) : await createStaffBooking(offer.practitionerId,user.sub,String(form.get('patient_id')||''),starts,offer.id,context.locals.requestId);
 return context.redirect(savedHref(data,await attemptAgendaBookingMail(data)),303);
 }
 const revision=String(form.get('revision')||'');
 if(operation!=='mail'&&!agendaInstant(revision))throw new Error('invalid_input');
 if(operation==='reschedule'){
 await rescheduleStaffBooking(id,user.sub,fromBrusselsLocalInput(String(form.get('starts_at')||'')),{requestId:context.locals.requestId,requestPath:context.url.pathname,practitionerId:booking!.practitioner_id,revision});
 }else if(operation==='mail'){
 const {error:me}=await db.rpc('retry_booking_mail',{p_actor:user.sub,p_job:String(form.get('job_id')||'')});fail(me);
 }else if(operation==='outcome'){
 await registerBookingOutcome(user.sub,id,revision,String(form.get('status')||''),String(form.get('category')||'unknown'),String(form.get('billing')||'unreviewed'),context.locals.requestId);
 }else if(operation==='status'){
 const status=String(form.get('status')||'');if(!['confirmed','declined','cancelled','completed','no_show'].includes(status))throw new Error('Ongeldige status.');
 await updateBookingStatus(id,booking!.practitioner_id,user.sub,status as BookingStatus,context.locals.requestId,context.url.pathname,revision);
 }else throw new Error('Onbekende actie.');
 const shouldNotify=operation==='reschedule'||operation==='mail'||operation==='status'&&['confirmed','cancelled'].includes(String(form.get('status')||''));
 return context.redirect(savedHref(id,shouldNotify ? await attemptAgendaBookingMail(id) : null),303);
 }catch(cause){
 const code=cause instanceof Error ? cause.message : (cause as {message?:string})?.message;
 error=code==='mail_superseded'?'Dit bericht is vervangen door een recentere wijziging.':code==='ambiguous_time'?'Dit uur komt tweemaal voor door de wintertijd. Kies een ander uur.':code==='nonexistent_time'?'Dit uur bestaat niet door de overgang naar zomertijd.':code==='invalid_time'?'Vul een geldig tijdstip in.':agendaError(cause).message;
 }
 }
 const client=id==='nieuw' ? submitted.patient_id || context.url.searchParams.get('client') || '' : '';
 const patient=agendaUuid.test(client) ? await getPatientReference(user,client,context.locals.requestId) : null;
 const patientAccount=patient ? await db.from('patients').select('email,customer_user_id').eq('id',patient.id).single() : null;
 if(patientAccount)fail(patientAccount.error);
 const initialClient=patient?.status==='active' ? {id:patient.id,name:patient.fullName,email:patientAccount?.data?.email||'',accountLinked:Boolean(patientAccount?.data?.customer_user_id)} : undefined;
 const selectedPractitioner=context.url.searchParams.get('professional') || '';
 const start=submitted.starts_at || context.url.searchParams.get('start') || '';
 const initialStart=/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(start) ? start : '';
 const canViewPatient=booking?.patient_id?Boolean(await getPatientReference(user,booking.patient_id,context.locals.requestId)):false;
 const mail=booking?await db.from('booking_mail_jobs').select('id,kind,status,attempts,last_error,created_at,sent_at,scheduled_for').eq('booking_id',id).order('created_at',{ascending:false}):{data:[],error:null};fail(mail.error);
 const history=booking?await db.from('booking_schedule_events').select('id,old_starts_at,new_starts_at,occurred_at').eq('booking_id',id).order('occurred_at',{ascending:false}):{data:[],error:null};fail(history.error);
 const outcomeHistory=booking?await db.from('security_audit_log').select('id,actor_user_id,occurred_at,before_snapshot,after_snapshot').eq('object_type','booking').eq('object_id',id).eq('action','booking.outcome_registered').order('occurred_at',{ascending:false}).limit(100):{data:[],error:null};fail(outcomeHistory.error);
 const actorIds=[...new Set((outcomeHistory.data||[]).map(event=>event.actor_user_id).filter(Boolean))];
 const actors=actorIds.length?await db.from('profiles').select('id,full_name').in('id',actorIds):{data:[],error:null};fail(actors.error);
 const actorNames=new Map((actors.data||[]).map(actor=>[actor.id,actor.full_name]));
 return {submitted,initialNew:submitted.new_name?{name:submitted.new_name,email:submitted.new_email||'',birthDate:submitted.new_birth_date||'',key:submitted.submission_key||''}:undefined,outcomeHistory:(outcomeHistory.data||[]).map(event=>({...event,actorName:actorNames.get(event.actor_user_id)||'Medewerker'})),booking,offers,initialClient,selectedPractitioner,initialStart,agendaHref,error,mail:mail.data||[],history:history.data||[],canViewPatient,isNew:id==='nieuw',practice};
}
export type AppointmentPage=Exclude<Awaited<ReturnType<typeof loadAppointmentPage>>,Response>;
