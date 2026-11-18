import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=(path,deps={})=>{const exports={};const {outputText}=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});vm.runInNewContext(outputText,{exports,require:name=>{if(!(name in deps))throw new Error(`Missing dependency ${name}`);return deps[name];},TextEncoder,Date,Intl,Error,Set,URL},{filename:path});return exports;};
const documents=load('../src/lib/noteDocument.ts');
const author={sub:'11111111-1111-4111-8111-111111111111',roles:['practitioner']};
const patient='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const note='22222222-2222-4222-8222-222222222222';
const setup=()=>{
 const calls=[];
 const records=load('../src/lib/clientRecords.ts',{'./noteDocument':documents,'./brusselsTime':{},'./patientDetails':{},'./securityAudit':{},'./supabase/server':{getSupabaseAdmin:()=>({from:()=>({select:()=>({eq:()=>({eq:()=>({is:()=>({maybeSingle:async()=>({data:{id:patient},error:null})})})})})}),rpc:async(name,args)=>{calls.push({name,args});return {data:name==='create_patient_note'?note:3,error:null};}})}});
 return {records,calls};
};
test('both storage routines receive the validated document with matching searchable text',async()=>{
 const {records,calls}=setup();const document=documents.plainNoteDocument('Tekst met\nregelovergang');
 document.content[0].content[0].marks=[{type:'bold'}];
 const common={patientId:patient,title:'Verslag',body:documents.noteDocumentText(document),document:JSON.stringify(document)};
 await records.createPatientNote({...common,bookingId:null,type:'session',occurredAt:'2026-11-18T10:00',status:'draft',correctsNoteId:null},author,{});
 await records.savePatientNoteVersion({...common,noteId:note,expectedVersion:2,finalize:false},author,{});
 assert.deepEqual(calls.map(call=>call.name),['create_patient_note','append_patient_note_version']);
 for(const {args} of calls){assert.equal(JSON.stringify(args.p_body_document),JSON.stringify(document));assert.equal(args.p_body,common.body);assert.equal(args.p_actor_user_id,author.sub);}
 assert.equal(calls[1].args.p_expected_version,2);
});
test('hostile and mismatched formatting never reaches a write RPC',async()=>{
 const {records,calls}=setup();
 for(const document of [{type:'doc',content:[{type:'script'}]},documents.plainNoteDocument('Andere tekst')])await assert.rejects(()=>records.savePatientNoteVersion({noteId:note,patientId:patient,expectedVersion:2,title:'Verslag',body:'Originele tekst',document,finalize:false},author,{}),/note_document/);
 assert.equal(calls.length,0);
});
