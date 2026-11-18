import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const auth={hasPermission:(user,permission)=>Boolean(user?.roles?.includes('super_admin') || user?.roles?.includes('editor') && permission!=='content.publish'),isTrustedFormOrigin:request=>request.headers.get('origin')==='http://localhost'};
const owner={sub:id,roles:['super_admin']};
function load(path,deps={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8').replaceAll('import.meta.env','__env'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(Object.hasOwn(deps,name),`Missing mock ${name}`);return deps[name];},__env:{PROD:false},Request,Response,URL,FormData,Buffer,Error,Date,Map,Set,Intl,console});
  return exports;
}
const pagination=load('lib/adminPagination.ts');
function store(tables={},failed='') {
  const calls=[];
  const db={from(table){
    const call={table,filters:[],start:0,end:Infinity,selection:'',values:null,head:false};calls.push(call);
    const q={
      select(selection,options={}){call.selection=selection;call.head=options.head;return q;},
      eq(key,value){call.filters.push(row=>row[key]===value);return q;},
      in(key,values){call.filters.push(row=>values.includes(row[key]));return q;},
      lt(key,value){call.filters.push(row=>row[key]<value);return q;},
      ilike(key,value){call.filters.push(row=>row[key].toLowerCase().includes(value.replaceAll('%','').toLowerCase()));return q;},
      or(){return q;},order(){return q;},range(start,end){call.start=start;call.end=end;return q;},
      limit(size){call.end=size-1;return q;},update(values){call.values=values;return q;},
      insert(values){call.insert=values;return q;},
      maybeSingle(){call.single=true;return q;},single(){call.single=true;return q;},
      then(resolve,reject){
        const matched=(tables[table]||[]).filter(row=>call.filters.every(filter=>filter(row)));
        const error=table===failed?{message:'offline'}:null;
        if(!error&&call.values)matched.forEach(row=>Object.assign(row,call.values));
        const rows=matched.slice(call.start,call.end+1);
        return Promise.resolve({data:call.head?null:call.single?rows[0]||null:rows,count:matched.length,error}).then(resolve,reject);
      },
    };return q;
  }};return {db,calls};
}
function request(values={},path='/admin/content/nieuw') {
  const form=new FormData();Object.entries(values).forEach(([name,value])=>form.set(name,value));
  return new Request('http://localhost'+path,{method:'POST',headers:{origin:'http://localhost'},body:form});
}
const input={title:'Een uitgebreid artikel',slug:'artikel',kind:'article',status:'draft',excerpt:'Intro',body:'Inhoud '.repeat(2500),seo_title:'SEO',seo_description:'Omschrijving'};
const security={auditActor:()=>({userId:id}),writeSecurityAudit:async()=>{}};
function contentSubmit(overrides={}) {
  const content=load('lib/adminContent.ts',{'./legacyRoutes':{legacyRoutes:{}},'./supabase/server':{},'./securityAudit':security,'./adminPagination':pagination});
  return load('lib/adminContentForm.ts',{'./adminContent':{...content,createContent:async()=>({id}),updateContent:async()=>({id}),...overrides},'./adminAuth':auth,'./securityAudit':security}).submitContentForm;
}
test('content validation failure retains all text and SEO without cookies or JavaScript',async()=>{
  let writes=0;const submit=contentSubmit({createContent:async()=>{writes++;}});
  const result=await submit(request({...input,title:'x'}),owner);
  assert.equal(result.status,422);assert.equal(result.draft.bodyText,input.body);assert.equal(result.draft.seoTitle,'SEO');assert.equal(writes,0);
});
test('duplicate slug and database failure retain submitted edits',async()=>{
  for(const reason of ['duplicate_slug','database_error']){
    const submit=contentSubmit({updateContent:async()=>{throw new Error(reason);}});
    const result=await submit(request(input),owner,'request',id);
    assert.equal(result.status,409);assert.equal(result.draft.bodyText,input.body);assert.equal(result.draft.slug,'artikel');assert.match(result.error,/behouden/);
  }
});
test('successful content save redirects only after persistence',async()=>{
  let saved;const submit=contentSubmit({createContent:async value=>{saved=value;return {id};}});
  const result=await submit(request(input),owner);
  assert.equal(result.status,303);assert.equal(saved.bodyText,input.body.trim());assert.equal(result.redirect,`/admin/content/${id}?created=1`);
});
test('publication permissions apply to current published content as well as requested status',async()=>{
  let writes=0;const submit=contentSubmit({getContent:async()=>({status:'published'}),updateContent:async()=>{writes++;}});
  assert.equal((await submit(request(input),{roles:['editor']},'',id)).status,403);
  assert.equal((await submit(request({...input,status:'published'}),{roles:['editor']})).status,403);
  assert.equal(writes,0);
  assert.equal((await submit(new Request('http://localhost/admin/content/nieuw',{method:'POST',body:new FormData()}),owner)).status,403);
});
test('loading an older version never publishes or saves it automatically',async()=>{
  let writes=0;const submit=contentSubmit({getContentVersion:async(content,version)=>{assert.equal(content,id);assert.equal(version,other);return {...input,bodyText:'Oude tekst',status:'published',versionNumber:4};},updateContent:async()=>{writes++;}});
  const result=await submit(request({load_version:other}),owner,'',id);
  assert.equal(result.status,200);assert.equal(result.draft.status,'draft');assert.equal(result.draft.bodyText,'Oude tekst');assert.equal(writes,0);
});
test('content version reads are scoped to the requested document',async()=>{
  const {db,calls}=store({content_items:[{id,kind:'page',title:'Current'}],content_versions:[{id:other,content_id:'another-document',body:{text:'Private other text'}}]});
  const service=load('lib/adminContent.ts',{'./legacyRoutes':{legacyRoutes:{}},'./supabase/server':{getSupabaseAdmin:()=>db},'./securityAudit':security,'./adminPagination':pagination});
  assert.equal(await service.getContentVersion(id,other),null);
  assert.equal(await service.getContentVersion('bad-id',other),null);
  assert.equal(calls.length,2);
});
test('page parsing and out-of-range navigation never strand records',async()=>{
  for(const value of [null,'0','-1','3.5','Infinity','oops'])assert.equal(pagination.adminPage(value),1);
  const rows=Array.from({length:61},(_,i)=>i);const offsets=[];
  const page=await pagination.readAdminPage((start,end)=>{offsets.push(start);return Promise.resolve({data:rows.slice(start,end+1),count:rows.length,error:null});},999);
  assert.equal(page.page,3);assert.equal(page.total,61);assert.equal(page.items.length,11);assert.equal(offsets[1],50);
  assert.equal(pagination.adminPageHref(new URL('http://localhost/admin/content?q=stress&kind=page'), 'pagina',2),' /admin/content?q=stress&kind=page&pagina=2'.trim());
});
test('complete reads cross the provider cap and fail closed on a later page error',async()=>{
  const rows=Array.from({length:1210},(_,i)=>i);
  assert.equal((await pagination.readAllAdminRows((start,end)=>Promise.resolve({data:rows.slice(start,end+1),error:null}))).length,1210);
  await assert.rejects(pagination.readAllAdminRows(start=>Promise.resolve({data:start?null:rows.slice(0,500),error:start?{message:'offline'}:null})),/volledig/);
});
test('customer lifetime spend includes orders beyond the last global 500',async()=>{
  const orders=Array.from({length:601},(_,i)=>({id:String(i),customer_user_id:id,status:i===600?'cancelled':'paid',total_cents:100}));
  orders.push({id:'another',customer_user_id:other,status:'paid',total_cents:999999});
  const {db}=store({admin_customer_profiles:[{id,full_name:'Client',created_at:'2026-01-01'}],orders});
  db.auth={admin:{getUserById:async()=>({data:{user:{email:'synthetic@example.invalid'}},error:null})}};
  const service=load('lib/superAdmin.ts',{'./supabase/server':{getSupabaseAdmin:()=>db},'./adminAuth':auth,'./adminPagination':pagination});
  const result=await service.listAdminCustomers();assert.equal(result.items[0].orderCount,601);assert.equal(result.items[0].totalCents,60000);
});
test('staff users beyond the first hundred Auth users remain visible',async()=>{
  const users=Array.from({length:101},(_,i)=>({id:String(i),email:`user${i}@example.invalid`,created_at:'2026-01-01'}));
  const {db}=store({user_roles:[{user_id:'100',role:'employee'}]});
  db.auth={admin:{listUsers:async({page,perPage})=>({data:{users:users.slice((page-1)*perPage,page*perPage)},error:null})}};
  const service=load('lib/adminUsers.ts',{'./supabase/server':{getSupabaseAdmin:()=>db},'./securityAudit':security,'./headshots':{}});
  const staff=await service.listAdminUsers();assert.equal(staff.find(user=>user.id==='100').roles[0],'employee');
});
test('missing staff role is rejected before account creation',async()=>{
  let touched=false;const service=load('lib/adminUsers.ts',{'./supabase/server':{getSupabaseAdmin:()=>{touched=true;}},'./securityAudit':security,'./headshots':{}});
  await assert.rejects(service.createStaffUser({email:'staff@example.invalid',fullName:'Test Staff',temporaryPassword:'a-long-temporary-password',role:''},{}),/invalid_input/);assert.equal(touched,false);
});
test('specialized products cannot be created through the generic product service',async()=>{
  let touched=false;const service=load('lib/adminProducts.ts',{'./supabase/server':{getSupabaseAdmin:()=>{touched=true;}},'./securityAudit':security});
  for(const type of ['module','guide','profile','questionnaire'])await assert.rejects(service.createProduct({type},{}),/specialized_editor_required/);
  assert.equal(touched,false);
});
test('module reload drafts retain only unsaved editable fields and never stale revisions or files',()=>{
  const drafts=load('lib/adminEditorDrafts.ts');
  const fields=drafts.editableFields([{name:'revision',type:'hidden',value:'1'},{name:'file',type:'file',value:'workbook.pdf'},{name:'title',type:'text',value:'Text'},{name:'target',type:'checkbox',value:id,checked:true}]);
  assert.equal(fields.length,2);
  const initial={save:[{name:'title',type:'text',value:'Original'}],asset:[]};
  const current={save:fields,asset:[{name:'title',type:'text',value:'Changed track'}]};
  const pending=drafts.changedEditorForms(initial,current,'asset');
  assert.deepEqual(Object.keys(pending),['save']);assert.equal(pending.save[0].value,'Text');
  assert.equal(Object.keys(drafts.parseEditorDraft('{"save":[{"name":"revision","type":"hidden","value":"1"}]}')).length,0);
  assert.equal(Object.keys(drafts.parseEditorDraft('broken')).length,0);
});
function mailService(fixture) {return load('lib/adminMail.ts',{'./supabase/server':{getSupabaseAdmin:()=>fixture.db},'./adminPagination':pagination});}
function mailRoute(fixture,{trusted=true,permission=true}={}) {
  let deliveries=0;const mail=mailService(fixture);
  const route=load('pages/api/admin/mail.ts',{'../../../lib/adminAuth':{isTrustedFormOrigin:()=>trusted,hasPermission:()=>permission},'../../../lib/mailWorker':{deliverQueuedMail:async()=>{deliveries++;}},'../../../lib/supabase/server':{getSupabaseAdmin:()=>fixture.db},'../../../lib/adminMail':mail});
  return {...route,get deliveries(){return deliveries;}};
}
test('mail retry requires acknowledgement before any audit, update or delivery',async()=>{
  const fixture=store();const route=mailRoute(fixture);
  assert.equal((await route.POST({request:request({retry_failed:'1'},'/api/admin/mail'),locals:{adminUser:owner}})).status,400);
  assert.equal(fixture.calls.length,0);assert.equal(route.deliveries,0);
});
test('targeted mail retry affects only a selected failed job and records the request first',async()=>{
  const rows=[{id,status:'failed',attempts:6,lease_token:'old'},{id:other,status:'failed',attempts:6},{id:'sent',status:'sent',attempts:1}];
  const fixture=store({commerce_mail_jobs:rows});const route=mailRoute(fixture);
  const response=await route.POST({request:request({retry_failed:'1',checked:'yes',queue:'commerce_mail_jobs',job_id:id},'/api/admin/mail'),locals:{adminUser:owner}});
  assert.equal(response.status,303);assert.equal(rows[0].status,'pending');assert.equal(rows[0].lease_token,null);assert.equal(rows[1].status,'failed');assert.equal(rows[2].status,'sent');assert.equal(fixture.calls[0].table,'security_audit_log');assert.equal(route.deliveries,1);
});
test('bad queue, job id, untrusted origin and insufficient permission cannot mutate mail',async()=>{
  for(const values of [{queue:'profiles',job_id:id},{queue:'commerce_mail_jobs',job_id:'invalid'},{job_id:id}]){
    const fixture=store();const route=mailRoute(fixture);assert.equal((await route.POST({request:request({retry_failed:'1',checked:'yes',...values}),locals:{adminUser:owner}})).status,400);assert.equal(fixture.calls.length,0);
  }
  for(const options of [{trusted:false},{permission:false}]){const fixture=store();const route=mailRoute(fixture,options);assert.equal((await route.POST({request:request(),locals:{adminUser:owner}})).status,403);assert.equal(fixture.calls.length,0);}
});
test('audit failure prevents mail requeue; support recovery never writes a nonexistent lease token',async()=>{
  const fixture=store({commerce_mail_jobs:[{id,status:'failed'}]},'security_audit_log');const route=mailRoute(fixture);
  const response=await route.POST({request:request({retry_failed:'1',checked:'yes'}),locals:{adminUser:owner}});
  assert.match(response.headers.get('location'),/error=processing_failed/);assert.equal(fixture.calls.length,1);assert.equal(route.deliveries,0);
  const support=store({support_mail_jobs:[{id,status:'failed'}]});await mailRoute(support).POST({request:request({retry_failed:'1',checked:'yes',queue:'support_mail_jobs'}),locals:{adminUser:owner}});
  assert.equal(Object.hasOwn(support.calls[1].values,'lease_token'),false);
});
test('legacy mail endpoint only redirects to the central recovery UI',async()=>{
  const route=load('pages/api/admin/catalog/mail.ts',{'../../../../lib/adminAuth':auth});
  const response=await route.POST({request:request(),locals:{adminUser:owner}});
  assert.equal(response.status,303);assert.equal(response.headers.get('location'),'http://localhost/admin/mail');
});
test('mail diagnostics never expose arbitrary provider messages or require missing website error columns',async()=>{
  const fixture=store({website_mail_jobs:[{id,status:'failed',attempts:6,created_at:'2026-01-01',last_error:'smtp://secret@private.invalid'}]});const mail=mailService(fixture);
  assert.doesNotMatch(mail.mailDiagnosis('smtp://secret@private.invalid'),/secret|private/);
  const result=await mail.getAdminMailPage('website_mail_jobs','failed',1);
  assert.equal(result.total,1);assert.ok(!fixture.calls[0].selection.includes('last_error'));assert.ok(!Object.hasOwn(result.items[0],'last_error'));
});
test('privacy summary counts every record while the default page only contains open requests',async()=>{
  const rows=Array.from({length:150},(_,i)=>({id:String(i),status:'resolved',due_at:'2025-01-01'}));rows.push({id,status:'received',due_at:'2026-01-01'});
  const {db}=store({data_subject_requests:rows});const service=load('lib/superAdmin.ts',{'./supabase/server':{getSupabaseAdmin:()=>db},'./adminAuth':auth,'./adminPagination':pagination});
  const result=await service.listDataSubjectRequests();assert.equal(result.open,1);assert.equal(result.resolved,150);assert.equal(result.total,1);assert.equal(result.items[0].id,id);
});
test('secondary text token meets AA on admin surfaces',()=>{
  const css=readFileSync(new URL('../src/styles/admin.css',import.meta.url),'utf8');const faint=css.match(/--admin-faint:\s*(#[0-9a-f]{6})/)[1];
  const luminance=hex=>{const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  for(const background of ['#ffffff','#f7f8f6','#f1f4f2'])assert.ok((luminance(background)+.05)/(luminance(faint)+.05)>=4.5,`${faint} on ${background}`);
});
test('generic product endpoint directs specialized types to the complete creation flow without writes',async()=>{
  let writes=0;
  const route=load('pages/api/admin/products/index.ts',{'../../../../lib/adminProducts':{createProduct:()=>{writes++;}},'../../../../lib/adminAuth':auth,'../../../../lib/securityAudit':security});
  for(const [type,target] of [['module','/admin/modules'],['guide','/admin/modules/nieuw'],['profile','/admin/vragenlijsten/nieuw'],['questionnaire','/admin/vragenlijsten/nieuw']]){
    const response=await route.POST({request:request({type}),locals:{adminUser:owner},url:new URL('http://localhost/api/admin/products')});
    assert.equal(response.status,303);assert.equal(new URL(response.headers.get('location')).pathname,target);
  }
  assert.equal(writes,0);
});
test('compatibility content endpoints preserve POST bodies using a method-preserving redirect',async()=>{
  for(const path of ['index.ts','[id].ts']){
    const route=load('pages/api/admin/content/'+path,{'../../../../lib/adminAuth':auth});
    const response=await route.POST({request:request(input),locals:{adminUser:owner},params:{id}});
    assert.equal(response.status,307);assert.match(response.headers.get('location'),/\/admin\/content\//);
  }
});
test('editor routing keeps the licensed book out of the module-details flow',()=>{
  const book=load('lib/ebooks/book.ts');
  const {adminProductEditorPath}=load('lib/adminProductRoutes.ts',{'./ebooks/book':book});
  assert.equal(adminProductEditorPath({id,type:'guide',slug:book.BOOK_SLUG}),`/admin/producten/${id}`);
  for(const type of ['module','guide'])assert.equal(adminProductEditorPath({id,type,slug:'regular-offer'}),`/admin/modules/${id}`);
  for(const type of ['profile','questionnaire'])assert.equal(adminProductEditorPath({id,type,slug:'regular-offer'}),`/admin/vragenlijsten/${id}`);
});
