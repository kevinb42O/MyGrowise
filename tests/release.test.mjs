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
  '../../../lib/catalog/mail':{},'../../../lib/catalog/server':{},'../../../lib/commerce/terms':{},'../../../lib/adminAuth':{isTrustedFormOrigin:()=>true},'../../../lib/catalog/pricing':{},
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
test('order confirmation sends a durable copy of the terms only to the buyer at order creation',async()=>{
 const sent=[];const terms=load('lib/commerce/terms.ts');
 const order={status:'paid',provider_reference:'TEST-REFERENCE',total_cents:2500,contact_snapshot:{email:'buyer@example.invalid',terms_text:terms.termsForEmail(),digital_delivery_consent:{statement:terms.digitalDeliveryStatement}},commerce_buyers:{email:'buyer@example.invalid',first_name:'Test',last_name:'Buyer'},order_items:[{product_type:'module',product_title:'Module'}]};
 const db={rpc:async()=>({data:[{id:'created',event:'created',target:'buyer'},{id:'team',event:'created',target:'team'},{id:'paid',event:'paid',target:'buyer'},{id:'delivery',event:'delivery',target:'buyer'}].map(job=>({...job,order_id:'test-order',lease_token:'lease'})),error:null}),from:table=>table==='orders'?{select:()=>({eq:()=>({single:async()=>({data:order,error:null})})})}:{update:()=>({eq:()=>({eq:async()=>({error:null})})})}};
 const {deliverCommerceMail}=load('lib/catalog/mail.ts',{
  '../commerce/websiteMail':{websiteMailReady:()=>true,sendWebsiteEmail:async(to,subject,text)=>{sent.push({to,subject,text});}},
  '../commerce/purchases':{makePurchaseLink:async()=> 'https://example.invalid/aankopen'},
  '../supabase/server':{getSupabaseAdmin:()=>db},'./pricing':{money:()=> '€25,00'},'../commerce/termsArchive':load('lib/commerce/termsArchive.ts'),
 },{PUBLIC_SITE_URL:'https://example.invalid'});
 const result=await deliverCommerceMail();assert.equal(result.sent,4);assert.equal(result.failed,0);
 assert.equal(sent[0].to,'buyer@example.invalid');assert.ok(sent[0].text.endsWith(terms.termsForEmail()));
 assert.match(sent[0].text,/Bevestiging directe digitale levering/);assert.ok(sent[0].text.includes(terms.digitalDeliveryStatement));assert.match(sent[0].text,/info@mygrowise.be/);
 for(const message of sent.slice(1))assert.ok(!message.text.includes('ALGEMENE VOORWAARDEN MYGROWISE'));
 sent.length=0;order.contact_snapshot={email:'buyer@example.invalid'};await deliverCommerceMail();
 assert.ok(sent[0].text.endsWith(load('lib/commerce/termsArchive.ts').legacyTerms20261029));
 assert.ok(!sent[0].text.includes('Bevestiging directe digitale levering'));
});
test('digital delivery consent is separately required and stored with agreed text for guest and account checkout',async()=>{
 const terms=load('lib/commerce/terms.ts');
 const product='00000000-0000-4000-8000-000000000001',submission='00000000-0000-4000-8000-000000000002';
 for(const signedIn of [false,true]){
  let snapshot;let calls=0;
  const form=new FormData();for(const [key,value] of Object.entries({terms:'accepted',ids:product,mode:'custom',hash:'a'.repeat(32),submission,email:'test@example.invalid'}))form.set(key,value);
  const {POST}=load('pages/api/checkout/catalog-order.ts',{
   '../../../lib/commerce/readiness':{salesEnabled:()=>true},'../../../lib/catalog/mail':{deliverCommerceMail:async()=>{}},
   '../../../lib/catalog/server':{quoteCatalog:async()=>({items:[{id:product,type:'module'}]})},'../../../lib/commerce/terms':terms,
   '../../../lib/adminAuth':{isTrustedFormOrigin:()=>true,isCustomerAccount:()=>signedIn},'../../../lib/catalog/pricing':{isUuid:()=>true},
   '../../../lib/supabase/server':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls++;snapshot=args.p_contact;assert.equal(name,signedIn?'create_account_checkout':'create_guest_catalog_order');return {data:'test-order'};}})},
   '../../../lib/wiseCheckout':{getWiseManualDetails:()=>({})},'../../../lib/supportMail':{rateLimitSupport:async()=>true},
   '../../../lib/commerce/purchases':{parseBuyer:()=>({email:'test@example.invalid'}),purchaseOwner:async()=>null,tokenValid:()=>true,digest:()=> 'hash',CHECKOUT_COOKIE:'mg_checkout',privateHeaders:{}},
  });
  const context={request:{formData:async()=>form,headers:new Headers(),url:'https://example.invalid/api/checkout/catalog-order'},locals:{currentUser:{sub:'user',email:'test@example.invalid'}},cookies:{get:()=>({value:'checkout'})}};
  assert.equal((await POST(context)).status,400);assert.equal(calls,0);
  form.set('digital_delivery','accepted');assert.equal((await POST(context)).status,303);assert.equal(calls,1);
  assert.equal(snapshot.terms_revision,terms.termsRevision);assert.equal(snapshot.terms_text,terms.termsForEmail());
  assert.equal(snapshot.digital_delivery_consent.statement,terms.digitalDeliveryStatement);
  assert.equal(snapshot.digital_delivery_consent.product_ids.join(','),product);
  const first=JSON.stringify(snapshot);assert.equal((await POST(context)).status,303);assert.equal(JSON.stringify(snapshot),first);
 }
 assert.equal(terms.digitalContentItems([{type:'module'},{type:'guide'},{type:'profile'},{type:'questionnaire'}]).length,2);
});
