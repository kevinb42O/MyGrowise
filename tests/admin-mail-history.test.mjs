import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path,deps,env={}) {
 const exports={};
 const source=readFileSync(new URL('../src/'+path,import.meta.url),'utf8').replaceAll('import.meta.env','__env');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name];},__env:env,URL,Date,Math,Error,Set,Buffer});
 return exports;
}
const pagination=load('lib/adminPagination.ts',{});
function database(tables) {
 const calls=[];
 const db={from(table){
  const call={table,filters:[],orders:[],start:0,end:Infinity};calls.push(call);
  const simple=(row,expression)=>{
   const [key,op,...parts]=expression.split('.');const value=parts.join('.');
   if(op==='is')return row[key]==null;
   if(op==='eq')return row[key]===value;
   if(op==='neq')return row[key]!=null&&row[key]!==value;
   throw new Error(expression);
  };
  const q={
   select(columns,options={}){call.columns=columns;call.head=options.head;return q;},
   eq(key,value){call.filters.push(row=>row[key]===value);return q;},
   is(key,value){assert.equal(value,null);call.filters.push(row=>row[key]==null);return q;},
   not(key,op,value){assert.equal(op,'is');assert.equal(value,null);call.filters.push(row=>row[key]!=null);return q;},
   or(expression){call.filters.push(row=>expression.split(',').some(part=>simple(row,part)));return q;},
   order(key,{ascending=true}={}){call.orders.push({key,ascending});return q;},
   range(start,end){call.start=start;call.end=end;return q;},
   then(resolve,reject){
    const rows=(tables[table]||[]).filter(row=>call.filters.every(fn=>fn(row)));
    rows.sort((a,b)=>{for(const {key,ascending} of call.orders){const c=String(a[key]).localeCompare(String(b[key]));if(c)return ascending?c:-c;}return 0;});
    const fields=call.columns.split(',');
    return Promise.resolve({data:call.head?null:rows.slice(call.start,call.end+1).map(row=>Object.fromEntries(fields.map(key=>[key,row[key]??null]))),count:rows.length,error:null}).then(resolve,reject);
   },
  };return q;
 }};
 return {db,calls};
}
function history(tables){const h=database(tables);return {...h,service:load('lib/adminMail.ts',{'./supabase/server':{getSupabaseAdmin:()=>h.db},'./adminPagination':pagination})};}
const sent=(id,extra={})=>({id,status:'sent',sent_at:'2026-11-18T10:00:00Z',created_at:'2026-11-17T10:00:00Z',attempts:1,...extra});

test('history and summary partition completed tasks consistently across every queue',async()=>{
 const tables={
  support_mail_jobs:[sent('support'),sent('no-date',{sent_at:null})],
  booking_mail_jobs:[sent('booking'),sent('superseded',{status:'superseded'}),sent('suppressed',{status:'suppressed'})],
  commerce_mail_jobs:[sent('commerce',{last_error:null}),sent('skip',{last_error:'delivery_access_inactive'}),sent('no-date',{sent_at:null})],
  website_mail_jobs:[sent('website',{delivery_outcome:'sent'}),sent('skip',{delivery_outcome:'skipped',sent_at:null}),sent('legacy',{delivery_outcome:null}),sent('invalid',{delivery_outcome:'sent',sent_at:null})],
 };
 const h=history(tables);const counts=await h.service.getAdminMailCounts();
 for(const queue of counts){
  const successful=await h.service.getAdminMailPage(queue.table,'sent',1);
  const uncertain=await h.service.getAdminMailPage(queue.table,'unconfirmed',1);
  assert.equal(queue.states.sent,1,queue.table);
  assert.equal(successful.total,queue.states.sent);
  assert.equal(uncertain.total,queue.states.unconfirmed);
  assert.equal(successful.items.length,1);
  assert.ok(successful.items[0].sent_at);
  assert.equal(successful.total+uncertain.total,tables[queue.table].filter(row=>row.status==='sent').length);
  assert.ok(successful.items.every(row=>!Object.hasOwn(row,'last_error')&&!Object.hasOwn(row,'delivery_outcome')));
 }
 const skipped=await h.service.getAdminMailPage('website_mail_jobs','unconfirmed',1);
 assert.match(skipped.items.find(row=>row.id==='skip').diagnosis,/geen e-mail verzonden/);
 assert.match(skipped.items.find(row=>row.id==='legacy').diagnosis,/niet bevestigd/);
});

test('recent transmissions lead, tied dates have stable IDs and all pages remain reachable',async()=>{
 const rows=Array.from({length:61},(_,i)=>sent(String(i).padStart(3,'0'),{sent_at:new Date(Date.UTC(2026,10,1+Math.floor(i/2))).toISOString()}));
 const h=history({support_mail_jobs:rows});
 const first=await h.service.getAdminMailPage('support_mail_jobs','sent',1);
 assert.equal(first.items[0].id,'060');assert.equal(first.items[1].id,'058');assert.equal(first.items[2].id,'059');
 const second=await h.service.getAdminMailPage('support_mail_jobs','sent',2);
 const last=await h.service.getAdminMailPage('support_mail_jobs','sent',999);
 assert.equal(first.total,61);assert.equal(second.items.length,25);assert.equal(last.page,3);assert.equal(last.items.length,11);
 assert.equal(new Set([...first.items,...second.items,...last.items].map(row=>row.id)).size,61);
 assert.equal(pagination.adminPageHref(new URL('https://example.invalid/admin/mail?queue=support_mail_jobs&status=sent'),'pagina',2,'#mailtaken'),'/admin/mail?queue=support_mail_jobs&status=sent&pagina=2#mailtaken');
});

test('invalid filters fall back safely and an empty successful history is valid',async()=>{
 const h=history({support_mail_jobs:[sent('failed',{status:'failed'})]});
 const invalid=await h.service.getAdminMailPage('not_a_table','bogus',1);
 assert.equal(invalid.queue.table,'support_mail_jobs');assert.equal(invalid.status,'failed');assert.equal(invalid.total,1);
 const empty=await h.service.getAdminMailPage('support_mail_jobs','sent',1);
 assert.equal(empty.total,0);assert.equal(empty.pages,1);
});

function websiteWorker({known=false,kind='purchase_access',fail=false,updateFail=false}={}) {
 const updates=[],messages=[];
 const job={id:'synthetic',kind,payload:{email:'synthetic@example.invalid',name:'Test',category:'Test',body:'Test'},attempts:1,lease_token:'lease'};
 const db={rpc:async()=>({data:[job]}),from(table){
  const q={update(value){updates.push(value);return q;},delete(){return q;},eq(){return q;},lt(){return q;},gte(){return q;},select(){return q;},limit(){return q;},
   then(resolve){return Promise.resolve({data:table==='commerce_buyers'&&known?[{id:'buyer'}]:[],error:updateFail&&updates.at(-1)?.status==='sent'?{message:'status failed'}:null}).then(resolve);}};
  return q;
 }};
 const service=load('lib/commerce/websiteMail.ts',{
  nodemailer:{default:{createTransport:()=>({sendMail:async msg=>{if(fail)throw new Error('SMTP failed');messages.push(msg);},close(){}})}},
  '../supabase/server':{getSupabaseAdmin:()=>db},'../supportMail':{supportMailReady:()=>true},
  './purchases':{makePurchaseLink:async()=>'https://example.invalid/synthetic'},
  '../emailTemplate':{renderEmail:()=>'<p>Test</p>',renderTextEmail:()=>'<p>Test</p>'},
 },{PROD:true,SUPPORT_FROM_EMAIL:'synthetic@example.invalid'});
 return {updates,messages,run:()=>service.deliverWebsiteMail()};
}
test('known buyer and contact mail record a real transmission and timestamp',async()=>{
 for(const args of [{known:true},{kind:'contact'}]){
  const h=websiteWorker(args);const result=await h.run();
  assert.equal(result.sent,1);assert.equal(h.messages.length,1);assert.equal(h.updates[1].delivery_outcome,'sent');assert.ok(h.updates[1].sent_at);
 }
});
test('an unknown buyer completes without sending, counting or dating a transmission',async()=>{
 const h=websiteWorker();const result=await h.run();
 assert.equal(result.sent,0);assert.equal(result.failed,0);assert.equal(h.messages.length,0);
 assert.equal(h.updates[1].status,'sent');assert.equal(h.updates[1].delivery_outcome,'skipped');assert.equal(h.updates[1].sent_at,null);
});
test('transport and status persistence failures remain retryable and never count as successful',async()=>{
 for(const args of [{known:true,fail:true},{known:true,updateFail:true}]){
  const h=websiteWorker(args);const result=await h.run();
  assert.equal(result.sent,0);assert.equal(result.failed,1);assert.equal(h.updates.at(-1).status,'pending');assert.ok(h.updates.at(-1).next_attempt_at);
 }
});
