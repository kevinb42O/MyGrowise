// Disposable, synthetic appointments only. Mail is suppressed unless the operator
// explicitly sets APPOINTMENT_TEST_MAIL_RECIPIENT to an agreed test mailbox.
// Run with: npx dotenv -e .env -- node tests/customer-rescheduling-http.mjs
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const origin=process.env.APPOINTMENT_TEST_ORIGIN||'http://localhost:4321';
const testUrl=new URL(origin);
assert.ok(['localhost','127.0.0.1'].includes(testUrl.hostname)||process.env.APPOINTMENT_TEST_ALLOW_DEPLOYED==='true'&&testUrl.origin==='https://mygrowise.vercel.app','Use a local server, or explicitly enable the known deployment.');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
const auth=createClient(process.env.PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const accounts=[],practitioner=randomUUID();let offer,patient,booking,feedSecret;let checks=0;
let importedEvent;
const mailRecipient=process.env.APPOINTMENT_TEST_MAIL_RECIPIENT||'';
assert.ok(!mailRecipient||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient),'Use one agreed test mailbox.');
const sentMail=[];
const gate=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});let gateOpen=false;
const request=(path,cookie='',form,formOrigin=origin)=>fetch(origin+path,{redirect:'manual',method:form?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(form?{origin:formOrigin}:{})},...(form?{body:form}:{})});
try{
 await db.connect();
 const user=async(role='customer')=>{
  const email=`reschedule-test-${randomUUID()}@example.invalid`,password=`Test-${randomUUID()}-aA1!`;
  const created=await auth.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
  accounts.push(created.data.user.id);
  if(role!=='customer'){await db.query('delete from public.user_roles where user_id=$1',[created.data.user.id]);await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[created.data.user.id,role]);}
  await db.query('insert into public.user_preferences(user_id,booking_email_enabled) values($1,false) on conflict(user_id) do update set booking_email_enabled=false',[created.data.user.id]);
  const signed=await auth.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;
  return {id:created.data.user.id,email,password,cookie:`mg_session=${signed.data.session.access_token}`};
 };
 let customer=await user(),other=await user();const therapist=await user('practitioner'),foreignTherapist=await user('practitioner');
 await db.query("insert into public.practitioners(id,slug,name,active,user_id) values($1,$2,'Tijdelijke reschedulingtest',true,$3)",[practitioner,`reschedule-test-${practitioner}`,therapist.id]);
 await db.query('insert into public.practitioner_settings(practitioner_id,minimum_notice_hours,booking_horizon_days) values($1,0,30)',[practitioner]);
 for(let day=1;day<=7;day++)await db.query("insert into public.availability_rules(practitioner_id,weekday,start_time,end_time) values($1,$2,'09:00','18:00')",[practitioner,day]);
 const type=(await db.query("select id from public.appointment_types where slug='intake-emdr-online'")).rows[0].id;
 offer=(await db.query('insert into public.practitioner_appointment_types(practitioner_id,appointment_type_id) values($1,$2) returning id',[practitioner,type])).rows[0].id;
 const original=(await db.query('select * from public.get_offer_slots($1,14)',[offer])).rows.find(s=>+new Date(s.starts_at)>Date.now()+2*86400000).starts_at;
 const details={first_name:'Tijdelijke',last_name:'Testcliënt',birth_date:'1990-03-04',gender:'unspecified',mobile:'+32400000000',country:'BE'};
 const submission=randomUUID();
 const bookingPage=await request(`/afspraak/${offer}`,customer.cookie);assert.equal(bookingPage.status,200);assert.ok((await bookingPage.text()).includes('Afspraak definitief boeken'));checks++;
 const submissions=[submission,randomUUID()];
 const raced=await Promise.all([customer,other].map((account,i)=>request(`/afspraak/${offer}`,account.cookie,new URLSearchParams({...details,submission_key:submissions[i],starts_at:new Date(original).toISOString()}))));
 assert.equal(raced.filter(r=>r.status===303&&r.headers.get('location')?.includes('confirmed=1')).length,1);checks++;
 const winner=raced.findIndex(r=>r.status===303);if(winner===1)[customer,other]=[other,customer];
 booking=(await db.query('select id from public.bookings where submission_key=$1',[submissions[winner]])).rows[0].id;
 assert.equal((await db.query('select count(*)::int n from public.bookings where practitioner_id=$1 and starts_at=$2',[practitioner,original])).rows[0].n,1);checks++;
 assert.equal((await db.query('select count(*)::int n from public.patients where customer_user_id=$1',[other.id])).rows[0].n,0);checks++;
 const from=new Date(+new Date(original)-86400000).toISOString(),to=new Date(+new Date(original)+14*86400000).toISOString();
 const agenda=async()=>{const response=await request(`/api/praktijk/agenda?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,therapist.cookie);assert.equal(response.status,200);return (await response.json()).events;};
 assert.ok((await agenda()).some(e=>e.id===booking&&e.status==='confirmed'));checks++;
 assert.ok((await(await request('/account/notificaties',customer.cookie)).text()).includes('Je afspraak is bevestigd'));checks++;

 patient=(await db.query('select patient_id from public.bookings where id=$1',[booking])).rows[0].patient_id;
 const detail=`/praktijk/afspraken/${booking}`;
 const openDetail=await request(detail,therapist.cookie);assert.equal(openDetail.status,200);assert.ok((await openDetail.text()).includes(`/admin/clienten/${patient}`));checks++;
 const dossier=await request(`/admin/clienten/${patient}`,therapist.cookie);assert.equal(dossier.status,200);assert.ok((await dossier.text()).includes('Tijdelijke Testcliënt'));checks++;
 const deniedDossier=await request(`/admin/clienten/${patient}`,foreignTherapist.cookie);assert.ok([302,303].includes(deniedDossier.status));assert.ok(deniedDossier.headers.get('location').includes('dossier_niet_gevonden'));checks++;
 const localTime=value=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;};
 const noteTitle='Synthetisch acceptatieverslag',noteBody='Uitsluitend fictieve tekst voor de technische acceptatieproef.';
 const noteForm=new URLSearchParams({booking_id:booking,note_type:'session',occurred_at:localTime(new Date()),title:noteTitle,body:noteBody,submit_status:'draft'});
 const noteCreated=await request(`/api/admin/clienten/${patient}/notities`,therapist.cookie,noteForm);assert.equal(noteCreated.status,303);assert.ok(noteCreated.headers.get('location').includes('melding=concept'));checks++;
 const note=(await db.query('select id from public.patient_notes where patient_id=$1',[patient])).rows[0];assert.ok(note);checks++;
 const finalize=await request(`/api/admin/notities/${note.id}`,therapist.cookie,new URLSearchParams({expected_version:'1',title:noteTitle,body:noteBody,submit_status:'final'}));assert.ok(finalize.headers.get('location')?.includes('melding=definitief'));checks++;
 const finalNote=(await db.query('select status,current_version from public.patient_notes where id=$1',[note.id])).rows[0];assert.equal(finalNote.status,'final');assert.equal(finalNote.current_version,2);checks++;
 const deniedNote=await request(`/api/admin/notities/${note.id}`,foreignTherapist.cookie,new URLSearchParams({expected_version:'2',title:'Onbevoegd',body:'Dit mag niet worden opgeslagen.'}));assert.equal(deniedNote.status,404);checks++;
 const immutable=await request(`/api/admin/notities/${note.id}`,therapist.cookie,new URLSearchParams({expected_version:'2',title:'Overschreven',body:'Dit mag niet worden opgeslagen.'}));assert.ok(immutable.headers.get('location')?.includes('fout='));assert.equal((await db.query('select title from public.patient_notes_current where id=$1',[note.id])).rows[0].title,noteTitle);checks++;
 const notePage=await(await request(`/admin/clienten/${patient}`,therapist.cookie)).text();assert.ok(notePage.includes(noteBody));checks++;
 const sendAgreedTestMail=async(kind)=>{
  if(!mailRecipient)return;
  const job=(await db.query('select id,payload from public.booking_mail_jobs where booking_id=$1 and kind=$2 order by created_at desc limit 1',[booking,kind])).rows[0];assert.ok(job);
  assert.ok(!JSON.stringify(job.payload).includes(noteBody));
  // Only this run's suppressed fixture job is enabled; every other job remains untouched.
  await db.query("update public.booking_mail_jobs set recipient=$2,status='pending',next_attempt_at=now() where id=$1 and status='suppressed'",[job.id,mailRecipient]);
  const sent=await request(detail,therapist.cookie,new URLSearchParams({operation:'mail',job_id:job.id}));assert.equal(sent.status,303);
  const state=(await db.query('select status,sent_at from public.booking_mail_jobs where id=$1',[job.id])).rows[0];assert.equal(state.status,'sent');assert.ok(state.sent_at);sentMail.push(kind);checks++;
 };
 await sendAgreedTestMail('confirmation');
 const nextStart=(await db.query('select * from public.get_offer_slots($1,14)',[offer])).rows.find(s=>+new Date(s.starts_at)>+new Date(original)+3*86400000).starts_at;
 const followupPage=await request(`/praktijk/afspraken/nieuw?client=${patient}`,therapist.cookie);assert.equal(followupPage.status,200);assert.ok((await followupPage.text()).includes(patient));checks++;
 const followup=await request('/praktijk/afspraken/nieuw',therapist.cookie,new URLSearchParams({patient_id:patient,offer_id:offer,starts_at:localTime(nextStart)}));assert.equal(followup.status,303);assert.match(followup.headers.get('location'),/\/praktijk\/afspraken\/[0-9a-f-]+\?opgeslagen=1/);checks++;
 const followupId=followup.headers.get('location').match(/afspraken\/([0-9a-f-]+)/)[1];
 assert.equal((await db.query('select patient_id from public.bookings where id=$1',[followupId])).rows[0].patient_id,patient);checks++;
 const path=`/account/begeleiding/${booking}/verplaatsen`;
 assert.equal((await request(path)).status,303);checks++;
 const foreign=await request(path,other.cookie);assert.equal(foreign.status,404);assert.ok(!(await foreign.text()).includes('Tijdelijke reschedulingtest'));checks++;
 const page=await request(path,customer.cookie);assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('Huidige afspraak behouden'));assert.ok(html.includes('name="previous_starts_at"'));checks++;
 const overview=await(await request('/account/begeleiding',customer.cookie)).text();assert.ok(overview.includes(path));assert.ok(!overview.includes('Ander moment aanvragen'));checks++;
 const slots=(await db.query('select * from public.get_customer_reschedule_slots($1,$2,14)',[customer.id,booking])).rows.filter(s=>+new Date(s.starts_at)>+new Date(original)+86400000);
 const form=start=>new URLSearchParams({starts_at:new Date(start).toISOString(),previous_starts_at:new Date(original).toISOString()});
 assert.equal((await request(path,customer.cookie,form(slots[0].starts_at),'https://untrusted.example.invalid')).status,403);checks++;
 // Two tabs submit different changes based on the same original time: only one wins.
 const responses=await Promise.all([request(path,customer.cookie,form(slots[0].starts_at)),request(path,customer.cookie,form(slots[1].starts_at))]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[303,400]);checks++;
 const rejected=responses.find(r=>r.status===400);const rejectedHtml=await rejected.text();const alert=rejectedHtml.match(/role="alert"[^>]*>([^<]+)/)?.[1]||'No error alert';assert.match(alert,/intussen gewijzigd/);checks++;
 const moved=(await db.query('select * from public.bookings where id=$1',[booking])).rows[0];assert.equal(moved.status,'confirmed');assert.notEqual(+moved.starts_at,+new Date(original));checks++;
 const replay=await request(path,customer.cookie,form(moved.starts_at));assert.equal(replay.status,303);assert.ok(replay.headers.get('location').includes('rescheduled=1'));checks++;
 assert.equal((await db.query('select count(*)::int n from public.booking_schedule_events where booking_id=$1',[booking])).rows[0].n,1);checks++;
 const jobs=(await db.query('select kind,status from public.booking_mail_jobs where booking_id=$1',[booking])).rows;assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.status==='suppressed'||mailRecipient&&j.status==='sent'));checks++;
 await sendAgreedTestMail('rescheduled');
 const notifications=await(await request('/account/notificaties',customer.cookie)).text();assert.ok(notifications.includes('Je afspraak is verplaatst'));assert.ok(!notifications.includes('Bekijk aanvraag'));checks++;
 const originalLabel=new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',dateStyle:'medium',timeStyle:'short'}).format(new Date(original));assert.ok(notifications.includes(originalLabel));checks++;
 // A slot may disappear after the form is opened. Neither time nor side effects change.
 const blocked=(await db.query('select * from public.get_customer_reschedule_slots($1,$2,14)',[customer.id,booking])).rows.find(s=>+new Date(s.starts_at)>+moved.ends_at);
 const block=(await db.query("insert into public.availability_exceptions(practitioner_id,starts_at,ends_at,kind) values($1,$2,$3,'unavailable') returning id",[practitioner,blocked.starts_at,blocked.ends_at])).rows[0].id;
 const unavailableForm=new URLSearchParams({starts_at:new Date(blocked.starts_at).toISOString(),previous_starts_at:moved.starts_at.toISOString()});
 const occupied=await request(path,customer.cookie,unavailableForm);assert.equal(occupied.status,400);assert.ok((await occupied.text()).includes('intussen bezet'));checks++;
 assert.equal(+(await db.query('select starts_at from public.bookings where id=$1',[booking])).rows[0].starts_at,+moved.starts_at);checks++;
 await db.query('delete from public.availability_exceptions where id=$1',[block]);
 // Reproduce a busy interval imported from MijnDiAd on this synthetic owner.
 // Never import, mutate or delete a real practitioner's source events.
 importedEvent=randomUUID();
 await db.query('begin');await db.query("set local mygrowise.mijndiad_import='on'");
 await db.query("insert into public.practice_calendar_events(id,practitioner_id,calendar_scope,title,starts_at,ends_at,event_kind,external_source,external_uid) values($1,$2,'itransform','Synthetisch extern bezet',$3,$4,'appointment','mijndiad',$5)",[importedEvent,practitioner,blocked.starts_at,blocked.ends_at,randomUUID().replaceAll('-','').repeat(2)]);await db.query('commit');
 assert.ok(!(await db.query('select * from public.get_offer_slots($1,14)',[offer])).rows.some(s=>+new Date(s.starts_at)===+new Date(blocked.starts_at)));checks++;
 const externalConflict=await request(detail,therapist.cookie,new URLSearchParams({operation:'reschedule',starts_at:localTime(blocked.starts_at)}));assert.ok((await externalConflict.text()).includes('overlapt'));assert.equal(+(await db.query('select starts_at from public.bookings where id=$1',[booking])).rows[0].starts_at,+moved.starts_at);checks++;
 await db.query('begin');await db.query("set local mygrowise.mijndiad_import='on'");await db.query('delete from public.practice_calendar_events where id=$1',[importedEvent]);await db.query('commit');importedEvent=null;
 const movedAgenda=(await agenda()).filter(e=>e.id===booking);assert.equal(movedAgenda.length,1);assert.equal(+new Date(movedAgenda[0].startsAt),+moved.starts_at);checks++;
 // Deterministic source outage on the synthetic practitioner only. Holding the
 // global refresh lock prevents tests from refreshing any real provider feed.
 feedSecret=(await db.query("select vault.create_secret('https://example.invalid/','reschedule_outage_'||gen_random_uuid()::text) id")).rows[0].id;
 await gate.connect();gateOpen=true;await gate.query('begin');await gate.query("select pg_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0))");
 await db.query("insert into practice_private.mijndiad_sync(practitioner_id,feed_secret_id,enabled,last_attempt_at,last_success_at,last_error,failure_count) values($1,$2,true,now(),now()-interval '1 hour','feed_unavailable_or_invalid',1)",[practitioner,feedSecret]);
 const deniedStaffMove=await request(detail,therapist.cookie,new URLSearchParams({operation:'reschedule',starts_at:localTime(blocked.starts_at)}));assert.equal(deniedStaffMove.status,200);assert.ok((await deniedStaffMove.text()).includes('bestaande afspraak blijft behouden'));checks++;
 const deniedStaffCreate=await request('/praktijk/afspraken/nieuw',therapist.cookie,new URLSearchParams({patient_id:patient,offer_id:offer,starts_at:localTime(blocked.starts_at)}));assert.ok((await deniedStaffCreate.text()).includes('externe agenda'));checks++;
 assert.equal((await request(path,customer.cookie)).status,503);checks++;
 const outage=await request(path,customer.cookie,unavailableForm);assert.equal(outage.status,503);assert.ok((await outage.text()).includes('bestaande afspraak blijft behouden'));checks++;
 const unchanged=(await db.query('select starts_at,status from public.bookings where id=$1',[booking])).rows[0];assert.equal(+unchanged.starts_at,+moved.starts_at);assert.equal(unchanged.status,'confirmed');checks++;
 assert.equal((await db.query('select count(*)::int n from public.booking_schedule_events where booking_id=$1',[booking])).rows[0].n,1);checks++;
 // Cancellation remains available during a source outage.
 const cancelled=await request(`/api/praktijk/boekingen/${booking}`,therapist.cookie,new URLSearchParams({status:'cancelled'}));assert.equal(cancelled.status,303);checks++;
 assert.equal((await db.query('select status from public.bookings where id=$1',[booking])).rows[0].status,'cancelled');checks++;
 assert.ok(!(await agenda()).some(e=>e.id===booking));checks++;
 assert.ok((await(await request('/account/notificaties',customer.cookie)).text()).includes('Je afspraak is geannuleerd'));checks++;
 assert.ok((await db.query('select status from public.booking_mail_jobs where booking_id=$1',[booking])).rows.every(j=>j.status==='suppressed'||mailRecipient&&j.status==='sent'));checks++;
 await sendAgreedTestMail('cancelled');
 const customerCancelled=await request(`/api/account/begeleiding/${followupId}/annuleren`,customer.cookie,new URLSearchParams());assert.equal(customerCancelled.status,303);assert.equal((await db.query('select status from public.bookings where id=$1',[followupId])).rows[0].status,'cancelled');checks++;
 await db.query('delete from practice_private.mijndiad_sync where practitioner_id=$1',[practitioner]);
 const released=(await db.query('select * from public.get_offer_slots($1,14)',[offer])).rows;assert.ok(released.some(s=>+new Date(s.starts_at)===+moved.starts_at));checks++;
 console.log(`${checks} HTTP checks passed: concurrent new bookings, dossier access, draft/final report, immutable final report, follow-up planning, rescheduling, agenda, notifications, concurrent edits, occupied slot, external-source outage and cancellation. SMTP-accepted test mails: ${sentMail.join(', ')||'none (suppressed)'}. Inbox receipt requires recipient confirmation.`);
}catch(error){console.error('HTTP test failed:',error.message);throw error;}finally{
 if(gateOpen){await gate.query('rollback');await gate.end();}
 await db.query('rollback');
 if(importedEvent){await db.query('begin');await db.query("set local mygrowise.mijndiad_import='on'");await db.query('delete from public.practice_calendar_events where id=$1 and practitioner_id=$2',[importedEvent,practitioner]);await db.query('commit');}
 await db.query('delete from practice_private.mijndiad_sync where practitioner_id=$1',[practitioner]);
 if(feedSecret)await db.query('delete from vault.secrets where id=$1',[feedSecret]);
 // Final notes reject the FK's SET NULL update when their booking is removed.
 // Delete only this run's synthetic notes first, then appointments and patient.
 if(patient)await db.query('delete from public.patient_notes where patient_id=$1',[patient]);
 await db.query('delete from public.bookings where practitioner_id=$1',[practitioner]);
 if(patient){await db.query('delete from public.security_audit_log where object_id=$1',[patient]);await db.query('delete from public.patients where id=$1',[patient]);}
 if(offer)await db.query('delete from public.practitioner_appointment_types where id=$1',[offer]);
 await db.query('delete from public.practitioners where id=$1',[practitioner]);
 if(accounts.length)await db.query('delete from public.security_audit_log where actor_user_id=any($1::uuid[])',[accounts]);
 for(const id of accounts){const result=await auth.auth.admin.deleteUser(id);if(result.error)throw result.error;}
 await db.end();console.log('Synthetic accounts, appointments and reports removed.');
}
