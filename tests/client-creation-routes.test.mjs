import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const load=(file,dependencies)=>{
 const exports={};const {outputText}=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 vm.runInNewContext(outputText,{exports,require:name=>dependencies[name]??require(name),Request,Response,URL,URLSearchParams,Date,Intl},{filename:file});return exports;
};
const user={sub:'11111111-1111-4111-8111-111111111111',roles:['practitioner'],practitionerId:'p1'};
const actor={auditActor:()=>({userId:user.sub})};
const clientId='22222222-2222-4222-8222-222222222222';
const context=(path,values)=>({url:new URL(`http://localhost${path}`),request:new Request(`http://localhost${path}`,values?{method:'POST',body:new URLSearchParams(values)}:{}),locals:{currentUser:user},params:{id:'nieuw'},redirect:(url,status)=>new Response(null,{status,headers:{location:url}})});
test('directory retains submitted name, email and assignee after failed atomic creation',async()=>{
 let received;
 const {loadClientDirectoryPage}=load('../src/lib/clientDirectoryPage.ts',{
  './adminAuth':{isTrustedFormOrigin:()=>true,hasPermission:()=>true},'./securityAudit':actor,
  './clientRecordErrors':{clientRecordError:()=> 'invalid_input'},
  './clientRecords':{createPatient:async input=>{received=input;throw new Error('invalid_input');},auditPatientDirectoryAccess:async()=>{},listPatientRecords:async()=>[],getPatientStaff:async()=>[],listUnlinkedCustomerAccounts:async()=>[]},
 });
 const values={first_name:'Anne Marie',last_name:'Van den Berg',email:'synthetic@example.invalid',assignee_user_id:user.sub};
 const result=await loadClientDirectoryPage(context('/praktijk/clienten',values));
 assert.deepEqual({...result.submitted},values);assert.equal(result.formError,'invalid_input');
 assert.equal(received.firstName,'Anne Marie');assert.equal(received.lastName,'Van den Berg');
});
const setup=()=>{
 const calls=[];
 const offers=[{id:'o1',practitionerId:'p1',active:true},{id:'o2',practitionerId:'p2',active:true}];
 const db={from:()=>{const query={select:()=>query,eq:()=>query,in:()=>query,order:()=>query,limit:()=>query,maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:{email:'synthetic@example.invalid'},error:null}),then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return query;}};
 const {loadAppointmentPage}=load('../src/lib/appointmentDetail.ts',{
  './staffBooking':{bookNewPatient:async(...args)=>{calls.push(args);throw new Error('invalid_input');}},
  './supabase/server':{getSupabaseAdmin:()=>db},
  './appointmentCatalog':{fail:error=>{if(error)throw error;},listOffers:async options=>offers.filter(o=>!options.practitionerId||o.practitionerId===options.practitionerId)},
  './adminAuth':{isTrustedFormOrigin:()=>true},'./clientRecords':{getPatientReference:async()=>({id:clientId,fullName:'Synthetic Client',status:'active'})},
  './brusselsTime':{fromBrusselsLocalInput:value=>`${value}:00Z`},'./bookingMail':{},'./practiceStore':{createStaffBooking:async()=>{throw new Error('invalid_input');}},
  './agendaData':{agendaError:()=>({message:'Controleer de gegevens.'}),agendaInstant:()=>true,agendaUuid:/^[0-9a-f-]{36}$/},
 });
 return {loadAppointmentPage,calls};
};
test('new appointment retains split names, birth date, key, offer, therapist and start on validation failure',async()=>{
 const {loadAppointmentPage,calls}=setup();
 const values={new_first_name:'Jean Pierre',new_last_name:'Van de Test',new_email:'synthetic@example.invalid',new_birth_date:'1988-02-29',submission_key:'synthetic-key',practitioner_id:'p1',offer_id:'o1',starts_at:'2026-12-02T10:00'};
 const result=await loadAppointmentPage(context('/praktijk/afspraken/nieuw',values));
 assert.equal(result.initialStart,values.starts_at);assert.equal(result.selectedPractitioner,'p1');assert.equal(result.submitted.offer_id,'o1');
 assert.deepEqual({...result.initialNew},{firstName:'Jean Pierre',lastName:'Van de Test',email:values.new_email,birthDate:values.new_birth_date,key:values.submission_key});
 assert.deepEqual(Array.from(calls[0].slice(2,4)),['Jean Pierre','Van de Test']);
});
test('forged therapist/type cannot create a booking and existing client/start survive the error',async()=>{
 const {loadAppointmentPage,calls}=setup();
 const result=await loadAppointmentPage(context('/praktijk/afspraken/nieuw',{patient_id:clientId,practitioner_id:'p2',offer_id:'o2',starts_at:'2026-12-02T10:00'}));
 assert.equal(calls.length,0);assert.ok(result.error);assert.equal(result.initialClient.id,clientId);assert.equal(result.initialStart,'2026-12-02T10:00');
 assert.deepEqual(Array.from(result.offers,o=>o.id),['o1']);
});
test('valid offer links preselect the offer within the permitted therapist scope',async()=>{
 const {loadAppointmentPage}=setup();
 const valid=await loadAppointmentPage(context('/praktijk/afspraken/nieuw?offer_id=o1'));
 assert.equal(valid.submitted.offer_id,'o1');assert.equal(valid.selectedPractitioner,'p1');
 const forged=await loadAppointmentPage(context('/praktijk/afspraken/nieuw?offer_id=o2'));
 assert.equal(forged.submitted.offer_id,undefined);
});
