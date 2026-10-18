import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps){const exports={};const code=ts.transpileModule(readFileSync(new URL('../src/lib/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:n=>{assert.ok(deps[n],n);return deps[n];},Error,Date,Map});return exports;}
test('shared freshness helper rejects unknown/stale state for booking but allows a readable cached agenda',async()=>{
 for(const result of [{data:{usable:false,sync:{enabled:true,lastError:'offline'}}},{error:{message:'private URL'}},{data:null}]){
  const calls=[];const service=load('mijndiadSync.ts',{'./supabase/server':{getSupabaseAdmin:()=>({rpc:async(...args)=>{calls.push(args);return result;}})}});
  await assert.rejects(service.ensurePracticeCalendarFresh('owner',{maxAgeSeconds:60}),e=>e.code==='external_calendar_unavailable'&&!e.message.includes('private URL'));
  assert.equal(calls[0][1].p_max_age_seconds,60);
  const cached=await service.ensurePracticeCalendarFresh('owner',{required:false});assert.equal(cached.usable,false);
 }
});
test('therapists without an external source can continue normally',async()=>{
 const service=load('mijndiadSync.ts',{'./supabase/server':{getSupabaseAdmin:()=>({rpc:async()=>({data:{configured:false,usable:true,sync:null}})})}});
 assert.equal((await service.ensurePracticeCalendarFresh('other')).usable,true);
});
test('availability is never queried when source verification fails',async()=>{
 let slotsQueried=false;
 const catalog=load('appointmentCatalog.ts',{'./supabase/server':{getSupabaseAdmin:()=>({rpc:()=>{slotsQueried=true;}})},'./mijndiadSync':{ensurePracticeCalendarFresh:async()=>{throw new Error('source offline');}}});
 await assert.rejects(catalog.getOfferSlots({id:'offer',practitionerId:'owner'}),/source offline/);assert.equal(slotsQueried,false);
});
