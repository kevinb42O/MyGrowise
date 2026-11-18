import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as crypto from 'node:crypto';
import ts from 'typescript';

const load=(path,deps={},env={})=>{
 const exports={};
 const source=readFileSync(new URL('../src/'+path,import.meta.url),'utf8').replaceAll('import.meta.env','__env');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,require:n=>{assert.ok(Object.hasOwn(deps,n),n);return deps[n];},__env:env,Response,Request,URL,Date,FormData,Headers,Promise,Error});
 return exports;
};
const book=load('lib/ebooks/book.ts');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const token='a'.repeat(43);

function accessFixture(){
 const state={status:'pending_payment',verified:null,right:'active',session:true,expired:false,owner:true,otherOwner:false,fail:false,signs:0};
 const db={from(table){
  const conditions=[];
  const q={select(){return q;},eq(k,v){conditions.push([k,'eq',v]);return q;},in(k,v){conditions.push([k,'in',v]);return q;},not(k,op,v){conditions.push([k,'not',v]);return q;},gt(){return q;},limit(){return q;},maybeSingle(){return q;},
   then(resolve){
    let data;
    if(table==='products')data={id:'book-id',slug:book.BOOK_SLUG};
    else if(table==='ebook_sessions')data=state.session&&!state.expired?{order_item_id:'item-id'}:null;
    else if(table==='ebook_files')data={storage_provider:'r2',object_path:'fien.pdf'};
    else if(table==='entitlements'){
     // Evaluate the query against a fixture, rather than hardcoding an allowed/denied result.
     const values={'product_id':'book-id','order_item_id':'item-id','status':state.right,'order_items.order_id':'order-id','order_items.orders.status':state.status,'order_items.orders.payment_verified_at':state.verified,'order_items.orders.provider':'wise_manual'};
     const matches=conditions.every(([k,op,v])=>op==='eq'?values[k]===v:op==='in'?v.includes(values[k]):values[k]!==v);
     data=matches?[{id:'right-id'}]:[];
    }else throw Error('Unexpected table '+table);
    return Promise.resolve({data,error:state.fail?{message:'offline'}:null}).then(resolve);
   }};return q;
 }};
 const purchases={digest:hash,tokenValid:v=>v===token,privateHeaders:{'cache-control':'private, no-store'},purchaseOwner:async()=>state.owner?{email:'buyer@example.invalid'}:null,purchaseOrders:async()=>state.otherOwner?[]:[{id:'order-id',status:state.status}]};
 const server=load('lib/ebooks/server.ts',{'node:crypto':crypto,'../supabase/server':{getSupabaseAdmin:()=>db},'../commerce/purchases':purchases,'./r2':{signR2BookUrl:()=>{state.signs++;return 'https://example.invalid/signed-book';}},'./book':book});
 const download=load('pages/api/boeken/download/[format].ts',{'../../../../lib/commerce/purchases':purchases,'../../../../lib/ebooks/server':server});
 const page=load('pages/api/boeken/pagina/[page].ts',{'../../../../lib/commerce/purchases':purchases,'../../../../lib/ebooks/server':server,'../../../../lib/ebooks/r2':{signR2BookUrl:()=>{state.signs++;return 'https://example.invalid/signed-page';}}});
 const cookies={get:name=>name==='mg_ebook'&&state.session?{value:token}:undefined};
 const request=(format='pdf')=>download.GET({params:{format},url:new URL('https://example.invalid/api/boeken/download/'+format),cookies,locals:{}});
 return {state,server,request,page:()=>page.GET({params:{page:'01'},cookies,locals:{}})};
}

test('an email identity, old book session, or paid flag cannot bypass manual payment confirmation',async()=>{
 const h=accessFixture();
 for(const owner of [false,true])for(const session of [false,true])for(const status of ['pending_payment','paid','fulfilled']){
  Object.assign(h.state,{owner,session,status,verified:null});
  assert.notEqual((await h.request()).status,303);
  assert.equal((await h.page()).status,401);
 }
 assert.equal(h.state.signs,0,'No file or page URL may be issued before staff confirmation');
});

test('manual confirmation unlocks verified owners without any activation license, including PDF and EPUB',async()=>{
 const h=accessFixture();Object.assign(h.state,{status:'paid',verified:'2026-11-18T09:00:00Z',session:false});
 for(const format of ['pdf','epub']){
  const response=await h.request(format);assert.equal(response.status,303);assert.match(response.headers.get('cache-control'),/no-store/);
 }
 assert.equal((await h.page()).status,302);
 h.state.otherOwner=true;
 assert.notEqual((await h.request()).status,303,'Other verified addresses do not own this purchase');
});

test('refunds, cancellation, revoked entitlements and expired book sessions block new signed URLs',async()=>{
 const h=accessFixture();Object.assign(h.state,{status:'paid',verified:'2026-11-18T09:00:00Z'});
 assert.equal((await h.request()).status,303);
 for(const status of ['pending_payment','refunded','cancelled']){
  h.state.status=status;assert.notEqual((await h.request()).status,303);assert.equal((await h.page()).status,401);
 }
 h.state.status='paid';h.state.right='revoked';assert.notEqual((await h.request()).status,303);
 Object.assign(h.state,{right:'active',owner:false,expired:true});assert.notEqual((await h.request()).status,303);
 h.state.expired=false;assert.equal((await h.request()).status,303,'Legacy valid book sessions still work');
 h.state.fail=true;assert.equal((await h.request()).status,503,'Database failures must fail closed');
});

test('a failed purchase token preserves the safe book destination and never sets a session',async()=>{
 const writes=[];
 const purchases=load('lib/commerce/purchases.ts',{'node:crypto':crypto,'../adminAuth':{},'../supabase/server':{},'../catalog/pricing':{}});
 const {POST}=load('pages/api/aankopen/toegang.ts',{'../../../lib/adminAuth':{isTrustedFormOrigin:()=>true},'../../../lib/supportMail':{rateLimitSupport:async()=>true},'../../../lib/supabase/server':{getSupabaseAdmin:()=>({rpc:async()=>({data:false})})},'../../../lib/commerce/purchases':purchases});
 for(const next of [book.BOOK_LIBRARY_PATH,'https://evil.invalid/','//evil.invalid/']){
  const response=await POST({request:new Request('https://example.invalid/api/aankopen/toegang',{method:'POST',body:new URLSearchParams({token,next})}),cookies:{set:(...args)=>writes.push(args)},url:new URL('https://example.invalid')});
  const target=new URL(response.headers.get('location'),'https://example.invalid');
  assert.equal(target.searchParams.get('next'),next===book.BOOK_LIBRARY_PATH?next:'/aankopen');
 }
 assert.equal(writes.length,0);
});

test('manual confirmation endpoint rejects customers and untrusted origins before touching payment records',async()=>{
 let calls=0;
 for(const [trusted,allowed,checked,status] of [[false,true,true,403],[true,false,true,403],[true,true,false,400],[true,true,true,303]]){
  const {POST}=load('pages/api/admin/wise-reconciliation/[id].ts',{'../../../../lib/catalog/mail':{deliverCommerceMail:async()=>{}},'../../../../lib/adminAuth':{isTrustedFormOrigin:()=>trusted,hasPermission:()=>allowed},'../../../../lib/supabase/server':{getSupabaseAdmin:()=>({rpc:async(name)=>{assert.equal(name,'confirm_wise_manual_payment');calls++;return {};}})}});
  const response=await POST({request:new Request('https://example.invalid/api/admin/wise-reconciliation/order',{method:'POST',body:new URLSearchParams(checked?{payment_received:'confirmed'}:{})}),params:{id:'00000000-0000-4000-8000-000000000001'},locals:{adminUser:{sub:'staff'}}});
  assert.equal(response.status,status);
 }
 assert.equal(calls,1);
});

test('new access requests claim only their fresh queued job, without draining an unrelated backlog',async()=>{
 const calls=[],jobId='00000000-0000-4000-8000-000000000009';
 const q={update:value=>{calls.push(value);return q;},eq:(...args)=>{calls.push(args);return q;},gte:()=>q,lt:()=>q,select:()=>Promise.resolve({data:[]})};
 const service=load('lib/commerce/websiteMail.ts',{nodemailer:{},'../supabase/server':{getSupabaseAdmin:()=>({from:()=>q,rpc:()=>{throw Error('Must not claim unrelated jobs');}})},'../supportMail':{supportMailReady:()=>true},'./purchases':{},'../emailTemplate':{}});
 // Cleanup after an empty claim also uses delete; it does not transmit anything.
 q.delete=()=>q;q.then=resolve=>Promise.resolve({}).then(resolve);
 const result=await service.deliverWebsiteMail(1,jobId);
 assert.equal(result.sent,0);
 assert.ok(calls.some(value=>Array.isArray(value)&&value[0]==='id'&&value[1]===jobId));
 assert.ok(calls.some(value=>Array.isArray(value)&&value[0]==='attempts'&&value[1]===0));
 assert.ok(calls.some(value=>value.status==='sending'&&value.lease_token===jobId));
});

test('a new book link retains its destination, keeps its secret in the fragment and stores only a hash',async()=>{
 let stored;
 const purchases=load('lib/commerce/purchases.ts',{'node:crypto':crypto,'../adminAuth':{},'../supabase/server':{getSupabaseAdmin:()=>({from:()=>({insert:async row=>{stored=row;return {};}})})},'../catalog/pricing':{}},{PUBLIC_SITE_URL:'https://example.invalid',PROD:true});
 const url=new URL(await purchases.makePurchaseLink('buyer@example.invalid',book.BOOK_LIBRARY_PATH));
 const fragment=new URLSearchParams(url.hash.slice(1));
 assert.equal(url.searchParams.get('next'),book.BOOK_LIBRARY_PATH);
 assert.equal(url.searchParams.has('token'),false);
 assert.equal(fragment.get('next'),book.BOOK_LIBRARY_PATH);
 assert.equal(stored.token_hash,hash(fragment.get('token')));
 assert.ok(!JSON.stringify(stored).includes(fragment.get('token')));
 assert.ok(Date.parse(stored.expires_at)>Date.now()+29*60000);
});

test('ebook checkout needs contact details only and returns recoverable JSON errors without creating a payment',async()=>{
 const purchases=load('lib/commerce/purchases.ts',{'node:crypto':crypto,'../adminAuth':{},'../supabase/server':{},'../catalog/pricing':{}});
 const terms=load('lib/commerce/terms.ts');
 const id='00000000-0000-4000-8000-000000000001';let failure=null,calls=[];
 const deps={
  '@vercel/functions':{waitUntil:()=>{}},'../../../lib/ebooks/book':book,'../../../lib/commerce/readiness':{salesEnabled:()=>true},'../../../lib/catalog/mail':{deliverCommerceMail:async()=>{}},
  '../../../lib/catalog/server':{quoteCatalog:async()=>({items:[{id,slug:book.BOOK_SLUG,type:'guide'}]})},'../../../lib/commerce/terms':terms,
  '../../../lib/adminAuth':{isTrustedFormOrigin:()=>true,isCustomerAccount:()=>false},'../../../lib/catalog/pricing':{isUuid:()=>true},
  '../../../lib/supabase/server':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return failure?{error:{message:failure}}:{data:'order-id'};}})},
  '../../../lib/wiseCheckout':{getWiseManualDetails:()=>({})},'../../../lib/supportMail':{rateLimitSupport:async()=>true},
  '../../../lib/commerce/purchases':{...purchases,purchaseOwner:async()=>null},
 };
 const {POST}=load('pages/api/checkout/catalog-order.ts',deps);
 const form={email:'buyer@example.invalid',first_name:'Zoë',last_name:'Voorbeeld',ids:id,mode:'custom',submission:id,hash:'a'.repeat(32),terms:'accepted',digital_delivery:'accepted'};
 const send=values=>POST({request:new Request('https://example.invalid/api/checkout/catalog-order',{method:'POST',body:new URLSearchParams(values),headers:{accept:'application/json'}}),locals:{},cookies:{get:()=>({value:token})}});
 let response=await send(form);assert.equal(response.status,200);assert.equal((await response.json()).location,'/bestellen?order=order-id');
 assert.equal(calls[0].name,'create_guest_catalog_order');
 assert.equal(calls[0].args.p_contact.birth_date,null);assert.equal(calls[0].args.p_contact.gender,'unspecified');
 for(const [value,status] of [['quote_changed',409],['database offline',503]]){
  failure=value;response=await send(form);assert.equal(response.status,status);assert.ok((await response.json()).error);
 }
 const before=calls.length;response=await send({...form,first_name:''});assert.equal(response.status,400);
 const error=(await response.json()).error;assert.match(error,/voornaam/);assert.doesNotMatch(error,/geboortedatum|geslacht/);assert.equal(calls.length,before);
 assert.ok(calls.every(call=>call.name==='create_guest_catalog_order'),'Checkout never invokes manual payment confirmation');
});

test('the storage worker rejects unsigned, expired or altered file/page URLs before accessing the bucket',async()=>{
 const {default:worker}=await import('../cloudflare/ebook-downloads/worker.mjs');
 let reads=0;
 const secret='synthetic-signing-secret';
 const env={EBOOK_R2_SIGNING_SECRET:secret,BOOKS:{head:async()=>{reads++;return {size:5,httpEtag:'test',etag:'test'};},get:async()=>{reads++;return {body:'%PDF-'};}}};
 const path='/jij-fien-en-een-toverkist-vol-superkrachten.pdf';
 const exp=String(Math.floor(Date.now()/1000)+60);
 const sig=crypto.createHmac('sha256',secret).update(`${path}\ndownload\n${exp}`).digest('hex');
 const valid=`https://example.invalid${path}?exp=${exp}&mode=download&sig=${sig}`;
 for(const url of [
  'https://example.invalid'+path,
  `https://example.invalid/fien-reader-r1/01.webp`,
  valid.replace(sig,'0'.repeat(64)),
  valid.replace(exp,String(Number(exp)-3600)),
  valid.replace('mode=download','mode=open'),
  valid.replace('.pdf?','.epub?'),
 ])assert.equal((await worker.fetch(new Request(url),env)).status,404);
 assert.equal(reads,0);
 const response=await worker.fetch(new Request(valid),env);
 assert.equal(response.status,200);assert.equal(await response.text(),'%PDF-');assert.match(response.headers.get('cache-control'),/no-store/);
});
