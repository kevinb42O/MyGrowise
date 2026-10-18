import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup({allowed=true,trusted=true,failure=false}={}) {
 const calls=[];const exports={};
 const deps={
  '../../../lib/appointmentCatalog':{},'../../../lib/bookingMail':{},
  '../../../lib/practiceAgenda':{getPracticeAgendaAccess:async()=>({canUseItransform:allowed}),listPracticeAgenda:async()=>[]},
  '../../../lib/adminAuth':{isTrustedFormOrigin:()=>trusted},'../../../lib/practiceStore':{},
  '../../../lib/clientRecords':{},'../../../lib/securityAudit':{},
  '../../../lib/mijndiadSync':{ensurePracticeCalendarFresh:async(owner,options)=>{calls.push({name:'ensure_mijndiad_fresh',args:{p_practitioner_id:owner},options});return {usable:!failure,sync:failure?{enabled:true,lastError:'feed_unavailable_or_invalid'}:{enabled:true,lastSuccessAt:'2026-10-18T19:35:00Z'}};},CALENDAR_UNAVAILABLE_MESSAGE:'Externe agenda tijdelijk niet bereikbaar.'},
  '../../../lib/supabase/server':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return failure?{error:{message:'private upstream details'}}:{data:{usable:true,configured:true}};}})},
 };
 const code=ts.transpileModule(readFileSync(new URL('../src/pages/api/praktijk/agenda.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{assert.ok(deps[name],name);return deps[name];},Response,Date});
 const context={request:{json:async()=>({action:'sync'})},locals:{currentUser:{sub:'user',practitionerId:'owner'}},url:new URL('https://example.invalid/api/praktijk/agenda?from=2026-10-19&to=2026-10-26')};
 return {route:exports,calls,context};
}

test('only the authorized practice identity and trusted origin can refresh MijnDiAd',async()=>{
 for(const options of [{allowed:false},{trusted:false}]){const {route,calls,context}=setup(options);assert.equal((await route.POST(context)).status,403);assert.equal(calls.length,0);}
 const {route,calls,context}=setup();assert.equal((await route.POST(context)).status,200);assert.equal(calls[0].name,'refresh_mijndiad_agenda');
});
test('refresh failures return a safe explanation and never upstream details',async()=>{
 const {route,context}=setup({failure:true});const r=await route.POST(context);assert.equal(r.status,503);const text=await r.text();assert.match(text,/vorige gegevens zijn behouden/);assert.doesNotMatch(text,/private upstream/);
});
test('agenda status is owner-scoped and excluded for users without Itransform access',async()=>{
 const yes=setup();const payload=await(await yes.route.GET(yes.context)).json();assert.equal(payload.sync.enabled,true);assert.equal(yes.calls[0].args.p_practitioner_id,'owner');
 const no=setup({allowed:false});assert.equal((await(await no.route.GET(no.context)).json()).sync,null);assert.equal(no.calls.length,0);
});
test('a failed source refresh keeps the existing agenda readable with a warning',async()=>{
 const {route,context}=setup({failure:true});const response=await route.GET(context);assert.equal(response.status,200);const payload=await response.json();assert.deepEqual(payload.events,[]);assert.equal(payload.sync.lastError,'feed_unavailable_or_invalid');
});
