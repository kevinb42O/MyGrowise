import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function route({transitionError,mailError}={}) {
 const calls=[];
 const dependencies={
  '../../../../lib/adminAuth':{isTrustedFormOrigin:()=>true},
  '../../../../lib/practiceStore':{updateBookingStatus:async()=>{calls.push('transition');if(transitionError)throw transitionError;}},
  '../../../../lib/bookingMail':{deliverBookingMail:async(limit,id)=>{calls.push(['mail',limit,id]);if(mailError)throw mailError;}},
 };
 const source=readFileSync(new URL('../src/pages/api/praktijk/boekingen/[id].ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(dependencies[name],name);return dependencies[name];},Response,Error});
 const context={request:new Request('http://localhost/api/praktijk/boekingen/test',{method:'POST',body:new URLSearchParams({status:'cancelled'})}),params:{id:'test'},locals:{currentUser:{sub:'therapist',practitionerId:'practice'},requestId:'request'}};
 return {run:()=>exports.POST(context),calls};
}

test('a practitioner status change attempts its own booking mail immediately',async()=>{
 const {run,calls}=route();assert.equal((await run()).status,303);
 assert.equal(calls[0],'transition');assert.deepEqual(calls[1],['mail',1,'test']);
});
test('SMTP failure does not undo or reject a successful status change',async()=>{
 const {run,calls}=route({mailError:new Error('SMTP unavailable')});
 const response=await run();assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/praktijk/boekingen?updated=1');assert.equal(calls.length,2);
});
test('a rejected status change never attempts mail',async()=>{
 const {run,calls}=route({transitionError:new Error('not_allowed')});
 assert.equal((await run()).status,403);assert.deepEqual(calls,['transition']);
});
