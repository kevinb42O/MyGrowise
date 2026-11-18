import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, dependencies={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];},Response,URL,URLSearchParams,console});
  return exports;
}
const {recordWorkspace,recordHref}=load('../src/lib/clientRecordWorkspace.ts');
test('workspace resolves legacy tasks and redirects while explicit navigation clears their context',()=>{
  for(const [path,section,note] of [
    ['', 'verslagen',''],['?concept=old','verslagen','old'],['?geschiedenis=version','verslagen','version'],
    ['?correctie=final','verslagen','nieuw'],['?boeking=appointment','verslagen','nieuw'],
    ['?melding=toegewezen','toegang',''],['?fout=archiveren_mislukt','toegang',''],['?melding=gegevens','gegevens',''],
    ['?status=completed&van=2026-11-01','afspraken',''],['#clientgegevens','gegevens',''],
    ['#afspraken','afspraken',''],['#verslag-note-id','verslagen','note-id'],['#nieuw-verslag','verslagen','nieuw'],
    ['?onderdeel=toegang&boeking=old','toegang',''],['?onderdeel=gegevens#nieuw-verslag','gegevens',''],
    ['?onderdeel=unknown','verslagen',''],
  ]) {
    const result=recordWorkspace(new URL('https://example.invalid/admin/clienten/id'+path));
    assert.equal(result.section,section,path);assert.equal(result.note,note,path);
  }
  const target=recordHref('/praktijk/clienten/id','verslagen',{verslag:'note&other=1',pagina:2});
  assert.equal(new URL(target,'https://example.invalid').searchParams.get('verslag'),'note&other=1');
  assert.ok(!target.includes('#'));
});

const patientId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',staffId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function portraitFixture({access=true,assigned=true,permission=true,headshot=true,badPath=false,downloadFails=false,existing='/images/practitioners/virginie-real.jpg'}={}) {
  const calls=[];
  const db={
    from(table){calls.push(table);const query={select(){return query;},eq(){return query;},is(){return query;},async maybeSingle(){return {data:table==='patient_assignments'?(assigned?{id:'assignment'}:null):{image_url:existing},error:null};}};return query;},
    auth:{admin:{async getUserById(id){calls.push(['account',id]);return {data:{user:{app_metadata:{headshot_path:headshot?`${badPath?'someone-else':staffId}/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp`:null}}},error:null};}}},
    storage:{from(){return {async download(path){calls.push(['download',path]);return {data:downloadFails?null:new Blob(['photo']),error:downloadFails?{}:null};}};}},
  };
  const {GET}=load('../src/pages/api/admin/clienten/[id]/teamfoto/[userId].ts',{
    '../../../../../../lib/adminAuth':{hasPermission:()=>permission},
    '../../../../../../lib/clientRecords':{getPatientReference:async()=>access?{id:patientId}:null},
    '../../../../../../lib/headshotPresentation':{ownHeadshotPath:(value,id)=>typeof value==='string'&&value.startsWith(id+'/')?value:null},
    '../../../../../../lib/headshots':{HEADSHOT_BUCKET:'user-headshots'},
    '../../../../../../lib/supabase/server':{getSupabaseAdmin:()=>db},
  });
  const request=(locals={currentUser:{sub:'viewer'}},params={id:patientId,userId:staffId})=>GET({locals,params});
  return {request,calls};
}
test('colleague photos require authentication, dossier access and an active assignment before account lookup',async()=>{
  assert.equal((await portraitFixture().request({})).status,401);
  for(const options of [{access:false},{assigned:false},{permission:false}]){
    const fixture=portraitFixture(options);assert.equal((await fixture.request()).status,404);
    assert.ok(!fixture.calls.some(call=>Array.isArray(call)));
  }
  const fixture=portraitFixture();assert.equal((await fixture.request(undefined,{id:'invalid',userId:staffId})).status,404);assert.deepEqual(fixture.calls,[]);
});
test('private portraits never expose storage paths and known practitioner photos use the user relation',async()=>{
  const fixture=portraitFixture();const response=await fixture.request();
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(await response.text(),'photo');
  assert.equal(fixture.calls.find(call=>call[0]==='account')[1],staffId);
  for(const options of [{headshot:false},{badPath:true}]){
    const fallback=portraitFixture(options);const result=await fallback.request();
    assert.equal(result.status,302);assert.equal(result.headers.get('location'),'/images/practitioners/virginie-real.jpg');
    assert.ok(!fallback.calls.some(call=>call[0]==='download'));
  }
  assert.equal((await portraitFixture({headshot:false,existing:'https://outside.invalid/photo.jpg'}).request()).status,404);
  assert.equal((await portraitFixture({downloadFails:true}).request()).status,404);
});
