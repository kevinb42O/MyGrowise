import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';
const load=(path,deps={},env={})=>{
 const exports={};const code=ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8').replaceAll('import.meta.env','__env'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:n=>{assert.ok(Object.hasOwn(deps,n),n);return deps[n];},__env:env,Response,URL,Date,FormData,Headers,Promise});return exports;
};
test('sales are closed by default in production and only explicit approval opens new orders',()=>{
 for(const [env,expected] of [[{PROD:true},false],[{PROD:true,COMMERCE_SALES_ENABLED:'false'},false],[{PROD:true,COMMERCE_SALES_ENABLED:'true'},true],[{PROD:false},true],[{PROD:false,COMMERCE_SALES_ENABLED:'false'},false]])assert.equal(load('lib/commerce/readiness.ts',{},env).salesEnabled(),expected);
});
test('closed checkout rejects new guest orders before parsing personal information or contacting the database',async()=>{
 let touched=false;const {POST}=load('pages/api/checkout/catalog-order.ts',{
  '../../../lib/commerce/readiness':{salesEnabled:()=>false,salesPausedMessage:'Verkoop gepauzeerd'},
  '../../../lib/catalog/mail':{},'../../../lib/adminAuth':{isTrustedFormOrigin:()=>true},'../../../lib/catalog/pricing':{},
  '../../../lib/supabase/server':{getSupabaseAdmin:()=>{touched=true;throw new Error('Must not run');}},'../../../lib/wiseCheckout':{},'../../../lib/supportMail':{},'../../../lib/commerce/purchases':{privateHeaders:{'cache-control':'private, no-store'}},
 });
 const r=await POST({request:{formData:()=>{touched=true;},headers:new Headers()},locals:{},cookies:{}});assert.equal(r.status,503);assert.equal(touched,false);
});
test('daily worker isolates queue failures and uses bounded batches on the free plan',async()=>{
 const calls=[];const deliver=key=>async limit=>{calls.push([key,limit]);if(key==='booking')throw new Error('offline');return {sent:1,failed:0};};
 const worker=load('lib/mailWorker.ts',{'./bookingMail':{deliverBookingMail:deliver('booking')},'./catalog/mail':{deliverCommerceMail:deliver('commerce')},'./commerce/websiteMail':{deliverWebsiteMail:deliver('website')},'./supportMail':{deliverSupportMail:deliver('support')}});
 const results=await worker.deliverQueuedMail();assert.equal(calls.length,4);assert.ok(calls.every(([,n])=>n===2));assert.equal(results.booking.unavailable,true);assert.equal(results.website.sent,1);
});
test('mail recovery requires a trusted origin and administrative integration permission',async()=>{
 let called=false;for(const trusted of [true,false]){const route=load('pages/api/admin/mail.ts',{'../../../lib/adminAuth':{isTrustedFormOrigin:()=>trusted,hasPermission:()=>false},'../../../lib/mailWorker':{deliverQueuedMail:()=>{called=true;}},'../../../lib/supabase/server':{getSupabaseAdmin:()=>{called=true;}}});assert.equal((await route.POST({request:{},locals:{}})).status,403);}assert.equal(called,false);
});
