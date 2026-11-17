import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(file,dependencies)=>{
 const exports={};const {outputText}=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 vm.runInNewContext(outputText,{exports,require:name=>{if(!(name in dependencies))throw new Error(`Missing test dependency ${name}`);return dependencies[name];},Request,Response,URL,URLSearchParams,Date,Intl,Error},{filename:file});return exports;
};
const user={sub:'author',roles:['practitioner']};
const setup=(records={})=>load('../src/lib/noteForm.ts',{'./clientRecords':records,'./securityAudit':{auditActor:()=>({})}}).saveNoteForm;
const form=(values)=>{const result=new FormData();for(const [k,v] of Object.entries(values))result.set(k,v);return result;};
test('create explicitly sends draft/final and returns a safe same-workspace destination',async()=>{
 for(const status of ['draft','final']){
  let saved;const save=setup({createPatientNote:async value=>{saved=value;}});
  const result=await save(form({operation:'create_note',title:'Sessie',body:'Synthetische tekst',submit_status:status,note_type:'session'}),user,'client','/praktijk/clienten');
  assert.equal(saved.status,status);assert.equal(saved.body,'Synthetische tekst');assert.match(result.location,/^\/praktijk\/clienten\/client\?melding=/);
 }
});
test('editing cannot mutate a note in a different patient dossier',async()=>{
 let mutated=false;const save=setup({getPatientByNote:async()=>({patientId:'other'}),savePatientNoteVersion:async()=>{mutated=true;}});
 const result=await save(form({operation:'save_note',note_id:'note'}),user,'client','/admin/clienten');
 assert.equal(mutated,false);assert.ok(result.error);assert.equal(result.location,'');
});
test('version conflict keeps the form open and offers comparison instead of overwrite',async()=>{
 const save=setup({getPatientByNote:async()=>({patientId:'client'}),savePatientNoteVersion:async()=>{throw new Error('version_conflict');}});
 const result=await save(form({operation:'save_note',note_id:'note',expected_version:'2'}),user,'client','/admin/clienten');
 assert.equal(result.location,'');assert.match(result.error,/tekst blijft hier staan/);assert.match(result.error,/tweede tabblad/);
});
test('failed native note POST re-renders submitted text without running patient-details updates',async()=>{
 let updated=false;const values={operation:'create_note',title:'Sessie titel',body:'Synthetische inhoud',occurred_at:'2026-11-18T10:00',note_type:'session',booking_id:'appointment'};
 const db={rpc:async(name)=>{if(name==='save_patient_details')updated=true;return {data:null,error:null};}};
 const patient={id:'client',canArchive:false,canManageAssignments:false,assignments:[],notes:[],bookings:[],details:{},linkableBookings:[]};
 const {loadClientDetailPage}=load('../src/lib/clientDetailPage.ts',{
  './patientAge':{patientAgeLabel:()=>''},'./patientSalutation':{salutationLabels:{}},
  './noteForm':{saveNoteForm:async()=>({error:'Opslaan mislukt',location:''})},
  './adminAuth':{hasPermission:()=>true,isTrustedFormOrigin:()=>true},'./patientDetails':{genderLabels:{},parsePatientDetails:()=>{throw new Error('Wrong operation');}},
  './supabase/server':{getSupabaseAdmin:()=>db},'./clientRecords':{getPatientDetail:async()=>patient,getBookingForNote:async()=>({id:'appointment',startsAt:'2026-11-18T09:00:00Z'}),noteTypeLabels:{}},
 });
 const request=new Request('http://localhost/praktijk/clienten/client',{method:'POST',body:form(values)});
 const result=await loadClientDetailPage({request,url:new URL(request.url),locals:{currentUser:user},params:{id:'client'},redirect:()=>{throw new Error('must retain form');}});
 assert.deepEqual({...result.submittedNote},values);assert.equal(result.noteError,'Opslaan mislukt');assert.equal(updated,false);assert.equal(result.bookingId,'appointment');assert.equal(result.noteBooking.id,'appointment');
});
