import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function queueHarness({count=25,stale=false,fail=false}={}) {
 const queue=Array.from({length:count},(_,id)=>({id:String(id),kind:'reminder',payload:{},recipient:'synthetic@example.invalid',attempts:1,lease_token:'lease'}));
 const claims=[],updates=[];let active=0,peak=0,deliveries=0;
 const db={rpc:async(name,args)=>{
  if(name==='booking_mail_is_current')return {data:!stale};
  assert.equal(name,'claim_booking_mail');claims.push(args.p_limit);return {data:queue.splice(0,args.p_limit)};
 },from:()=>({update:value=>{updates.push(value);const result={eq:()=>result,then:resolve=>Promise.resolve({error:null}).then(resolve)};return result;}})};
 const dependencies={
  './supabase/server':{getSupabaseAdmin:()=>db},
  './bookingMailContent':{bookingMailContent:()=>({subject:'Reminder',text:'Synthetic',html:'<p>Synthetic</p>'})},
  './commerce/websiteMail':{websiteMailReady:()=>true,sendWebsiteEmail:async()=>{active++;peak=Math.max(peak,active);try{await new Promise(resolve=>setTimeout(resolve,1));if(fail)throw new Error('synthetic SMTP failure');deliveries++;}finally{active--;}}},
 };
 const source=readFileSync(new URL('../src/lib/bookingMail.ts',import.meta.url),'utf8').replaceAll('import.meta.env','({})');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(dependencies[name],name);return dependencies[name];},Promise,Date,Math,Error});
 return {run:()=>exports.deliverBookingMail(100),claims,updates,metrics:()=>({peak,deliveries})};
}
test('the daily booking worker drains more than one batch with at most four simultaneous deliveries',async()=>{
 const h=queueHarness();const result=await h.run();assert.equal(result.sent,25);assert.equal(result.failed,0);assert.equal(result.processed,25);
 assert.ok(h.claims.every(n=>n<=4));assert.equal(h.metrics().deliveries,25);assert.ok(h.metrics().peak>1&&h.metrics().peak<=4);
});
test('obsolete reminders are suppressed before the mail transport is called',async()=>{
 const h=queueHarness({count:5,stale:true});const result=await h.run();assert.equal(result.sent,0);assert.equal(h.metrics().deliveries,0);assert.equal(h.updates.filter(u=>u.status==='superseded').length,5);
});
test('SMTP failure retains durable jobs for retry without stopping the rest of the batch',async()=>{
 const h=queueHarness({count:6,fail:true});const result=await h.run();assert.equal(result.failed,6);assert.equal(result.sent,0);assert.equal(h.updates.filter(u=>u.status==='pending'&&u.next_attempt_at).length,6);
});

function reminderRoute({configured=true,fail=false}={}){
 let calls=0;
 const source=readFileSync(new URL('../src/pages/api/cron/booking-reminders.ts',import.meta.url),'utf8').replaceAll('import.meta.env',JSON.stringify(configured?{CRON_SECRET:'synthetic-cron-secret'}:{}));
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,Response,Boolean,require:()=>({deliverBookingMail:async limit=>{assert.equal(limit,100);calls++;if(fail)throw new Error('private transport details');return {sent:2};}})});
 const context=token=>({request:new Request('https://example.invalid/api/cron/booking-reminders',{headers:token?{Authorization:`Bearer ${token}`}:{}})});
 return {route:exports,context,calls:()=>calls};
}
test('reminder endpoint requires its secret and its deployment probe never sends mail',async()=>{
 const h=reminderRoute();
 assert.equal((await h.route.GET(h.context())).status,401);
 assert.equal((await h.route.GET(h.context('wrong'))).status,401);
 assert.equal((await h.route.HEAD(h.context('synthetic-cron-secret'))).status,204);
 assert.equal(h.calls(),0);
 const missing=reminderRoute({configured:false});
 assert.equal((await missing.route.GET(missing.context('synthetic-cron-secret'))).status,401);
});
test('authorized reminder calls drain the queue and transport errors remain private',async()=>{
 const h=reminderRoute();const response=await h.route.GET(h.context('synthetic-cron-secret'));
 assert.equal(response.status,200);assert.equal((await response.json()).sent,2);assert.equal(h.calls(),1);
 const broken=reminderRoute({fail:true});const failure=await broken.route.GET(broken.context('synthetic-cron-secret'));
 assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/private transport/);
});
