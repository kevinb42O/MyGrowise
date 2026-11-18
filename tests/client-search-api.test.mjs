import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup({ trusted = true, failure = false, count = 9 } = {}) {
 const calls=[]; const exports={};
 const source=ts.transpileModule(readFileSync(new URL('../src/pages/api/admin/clienten/zoeken.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:Array.from({length:count},(_,i)=>({id:String(i),name:'Cliënt '+i,email:null,status:'active'})),error:failure?new Error('private database message'):null};}};
 const deps={
  '../../../../lib/adminAuth':{isTrustedFormOrigin:()=>trusted},
  '../../../../lib/clientRecords':{auditPatientDirectoryAccess:async()=>calls.push('audit'),listPatientRecords:async()=>[]},
  '../../../../lib/supabase/server':{getSupabaseAdmin:()=>db},
 };
 vm.runInNewContext(source,{exports,require:name=>deps[name],Response});
 return {calls,post:form=>exports.POST({request:new Request('https://mygrowise.be/api/admin/clienten/zoeken',{method:'POST',body:new URLSearchParams(form)}),locals:{currentUser:{sub:'trusted-actor'},requestId:'request-1'}})};
}
test('compact search sends trusted identity and explicit archive filter, returning eight plus hasMore',async()=>{
 const s=setup();const response=await s.post({compact:'1',search:' paarden zoe ',include_archived:'1'});
 const payload=await response.json();assert.equal(payload.clients.length,8);assert.equal(payload.hasMore,true);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(JSON.parse(JSON.stringify(s.calls[1])),{name:'search_patient_choices_v2',args:{p_actor:'trusted-actor',p_search:'paarden zoe',p_recent:false,p_status:'all',p_limit:9}});
});
test('recent lookup uses five active dossiers and never claims more matches',async()=>{
 const s=setup({count:5});const response=await s.post({compact:'1',search:'   '});const payload=await response.json();
 assert.equal(payload.clients.length,5);assert.equal(payload.hasMore,false);
 assert.equal(s.calls[1].args.p_status,'active');assert.equal(s.calls[1].args.p_recent,true);assert.equal(s.calls[1].args.p_limit,5);
});
test('untrusted origin stops search and errors never expose database messages',async()=>{
 const s=setup({trusted:false});assert.equal((await s.post({compact:'1'})).status,403);assert.deepEqual(s.calls,[]);
 const failed=setup({failure:true});const response=await failed.post({compact:'1',search:'naam'});
 assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'search_unavailable'});
});
