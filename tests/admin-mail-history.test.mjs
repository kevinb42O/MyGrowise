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
 const db={rpc:async name=>{
  assert.equal(name,'admin_mail_counts');
  const groups=new Map();
  for(const row of tables.admin_mail_overview||[]){
   if(!['sent','pending','sending','failed','unconfirmed'].includes(row.display_status))continue;
   const key=row.queue+':'+row.display_status;
   const group=groups.get(key)||{queue:row.queue,status:row.display_status,total:0};group.total++;groups.set(key,group);
  }
  return {data:[...groups.values()],error:null};
 },from(table){
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
function history(tables){const h=database({admin_mail_overview:Object.entries(tables).flatMap(([queue,rows])=>rows.map(row=>({...row,queue})))});return {...h,service:load('lib/adminMail.ts',{'./supabase/server':{getSupabaseAdmin:()=>h.db},'./adminPagination':pagination})};}
const sent=(id,extra={})=>({id,status:'sent',display_status:'sent',kind:'confirmation',sent_at:'2026-11-18T10:00:00Z',created_at:'2026-11-17T10:00:00Z',attempts:1,...extra});

test('history and summary partition completed tasks consistently across every queue',async()=>{
 const tables={
  support_mail_jobs:[sent('support'),sent('no-date',{sent_at:null,display_status:'unconfirmed'})],
  booking_mail_jobs:[sent('booking'),sent('superseded',{status:'superseded',display_status:'superseded'}),sent('suppressed',{status:'suppressed',display_status:'suppressed'})],
  commerce_mail_jobs:[sent('commerce',{diagnosis_code:null}),sent('skip',{diagnosis_code:'delivery_access_inactive',display_status:'unconfirmed',completion_outcome:'skipped'}),sent('no-date',{sent_at:null,display_status:'unconfirmed'})],
  website_mail_jobs:[sent('website',{completion_outcome:'sent'}),sent('skip',{display_status:'unconfirmed',completion_outcome:'skipped',sent_at:null}),sent('legacy',{display_status:'unconfirmed',completion_outcome:'unconfirmed'}),sent('invalid',{display_status:'unconfirmed',sent_at:null})],
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
 const h=history({support_mail_jobs:[sent('failed',{status:'failed',display_status:'failed'})]});
 const invalid=await h.service.getAdminMailPage('not_a_table','bogus',1);
 assert.equal(invalid.queue,null);assert.equal(invalid.status,'sent');assert.equal(invalid.total,0);
 const empty=await h.service.getAdminMailPage('support_mail_jobs','sent',1);
 assert.equal(empty.total,0);assert.equal(empty.pages,1);
});

test('combined pagination orders all categories together and uses queue plus ID for ties',async()=>{
 const queues=['support_mail_jobs','commerce_mail_jobs','booking_mail_jobs','website_mail_jobs'];
 const tables=Object.fromEntries(queues.map((queue,index)=>[queue,Array.from({length:17},(_,i)=>sent(String(i),{kind:'unknown',sent_at:new Date(Date.UTC(2026,10,1+i, index)).toISOString()}))]));
 const h=history(tables);const pages=await Promise.all([1,2,3].map(n=>h.service.getAdminMailPage('','sent',n)));
 const all=pages.flatMap(page=>page.items);
 assert.equal(pages[0].total,68);assert.equal(all.length,68);
 assert.equal(new Set(all.map(row=>row.queue+row.id)).size,68);
 assert.equal(all[0].queue,'website_mail_jobs');assert.equal(all[0].id,'16');
 for(let i=1;i<all.length;i++)assert.ok(all[i-1].sent_at>=all[i].sent_at);
 const counts=await h.service.getAdminMailCounts();
 assert.equal(h.service.scopedMailCounts(counts,'').sent,68);
 assert.equal(h.service.scopedMailCounts(counts,'booking_mail_jobs').sent,17);
});

test('safe labels and filter links preserve scope while removing old page and outcome flags',()=>{
 const {service}=history({});
 assert.equal(service.mailTitle('booking_mail_jobs','confirmation'),'Afspraakbevestiging');
 assert.equal(service.mailTitle('website_mail_jobs','private text'),'Contact en aankooplinks');
 assert.equal(service.mailTitle('booking_mail_jobs','constructor'),'Afspraken');
 assert.equal(service.adminMailHref(new URL('https://example.invalid/admin/mail?pagina=5&processed=1'),'booking_mail_jobs','pending'),'/admin/mail?queue=booking_mail_jobs&status=pending');
 assert.equal(service.adminMailHref(new URL('https://example.invalid/admin/mail'),'unsafe','invalid'),'/admin/mail?status=sent');
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
