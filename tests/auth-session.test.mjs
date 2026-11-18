import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jwt = seconds => `header.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+seconds})).toString('base64url')}.signature`;
function setup({refreshError, invalid=false}={}) {
  const calls={refresh:[],verify:[],revoke:[]};
  const user={sub:'synthetic',roles:['practitioner'],practitionerId:'practice'};
  const tokens={user,accessToken:jwt(3600),refreshToken:'rotated-refresh'};
  const deps={SUPABASE_SESSION_COOKIE:'mg_session',verifySupabaseSession:async token=>{calls.verify.push(token);return token&&!invalid?user:null;},refreshSupabaseSession:async token=>{calls.refresh.push(token);if(refreshError)throw refreshError;return invalid?null:tokens;},revokeSupabaseSession:async token=>calls.revoke.push(token)};
  const source=readFileSync(new URL('../src/lib/authSession.ts',import.meta.url),'utf8').replace('import.meta.env.PROD','true');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,require:()=>deps,Buffer,Date});
  const values=new Map();const written=[];const deleted=[];
  const cookies={get:name=>values.has(name)?{value:values.get(name)}:undefined,set:(name,value,options)=>{values.set(name,value);written.push({name,value,options});},delete:name=>{values.delete(name);deleted.push(name);}};
  return {api:exports,cookies,values,written,deleted,calls,tokens,user};
}
test('remembered login stores protected cookies for 30 days; browser session has no persistent expiry',()=>{
 for(const remember of [false,true]) {
  const s=setup();s.api.setAuthSession(s.cookies,s.tokens,remember);
  assert.equal(s.written.length,3);
  for(const {options} of s.written){assert.equal(options.httpOnly,true);assert.equal(options.secure,true);assert.equal(options.sameSite,'strict');assert.equal(options.path,'/');assert.equal(options.maxAge,remember?2592000:undefined);}
  assert.equal(s.values.get('mg_remember'),remember?'1':'0');
 }
});
test('valid access token is verified without rotating refresh tokens on every request',async()=>{
 const s=setup();s.api.setAuthSession(s.cookies,s.tokens,true);s.written.length=0;
 assert.equal((await s.api.resolveAuthSession(s.cookies)).user,s.user);assert.equal(s.calls.refresh.length,0);assert.equal(s.calls.verify.length,1);assert.equal(s.written.length,0);
});
test('expired, nearly expired and absent access tokens recover using the refresh cookie',async()=>{
 for(const access of [jwt(-7200),jwt(30),undefined,'malformed']) {
  const s=setup();s.values.set('mg_refresh','old-refresh');s.values.set('mg_remember','1');if(access)s.values.set('mg_session',access);
  assert.equal((await s.api.resolveAuthSession(s.cookies)).user,s.user);assert.deepEqual(s.calls.refresh,['old-refresh']);assert.equal(s.values.get('mg_refresh'),'rotated-refresh');assert.ok(s.written.every(row=>row.options.maxAge===2592000));
 }
});
test('refresh preserves unchecked preference, also with another tab using the same cookies',async()=>{
 const s=setup();s.values.set('mg_session',jwt(-1));s.values.set('mg_refresh','shared-refresh');s.values.set('mg_remember','0');
 const results=await Promise.all([s.api.resolveAuthSession(s.cookies),s.api.resolveAuthSession(s.cookies)]);
 assert.ok(results.every(result=>result.user===s.user));assert.ok(s.written.every(row=>row.options.maxAge===undefined));
});
test('provider interruption retains every cookie so retry can recover',async()=>{
 const s=setup({refreshError:new Error('temporary outage')});s.values.set('mg_session',jwt(-1));s.values.set('mg_refresh','keep-me');
 await assert.rejects(()=>s.api.resolveAuthSession(s.cookies),/temporary outage/);assert.equal(s.values.get('mg_refresh'),'keep-me');assert.equal(s.deleted.length,0);
});
test('invalid/revoked refresh token clears all session cookies',async()=>{
 const s=setup({invalid:true});s.api.setAuthSession(s.cookies,{accessToken:jwt(-1),refreshToken:'revoked'},true);
 assert.equal(await s.api.resolveAuthSession(s.cookies),null);assert.equal(s.values.size,0);assert.equal(s.deleted.length,3);
});
test('legacy one-hour session still works until expiry and then requires one new login',async()=>{
 const s=setup();s.values.set('mg_session',jwt(1800));assert.ok(await s.api.resolveAuthSession(s.cookies));
 const invalid=setup({invalid:true});invalid.values.set('mg_session',jwt(-1));assert.equal(await invalid.api.resolveAuthSession(invalid.cookies),null);assert.equal(invalid.values.size,0);
});
test('logout revokes the local session and removes all cookies, including after access expiry',async()=>{
 const s=setup();s.api.setAuthSession(s.cookies,{accessToken:jwt(-1),refreshToken:'old'},true);
 await s.api.logoutAuthSession(s.cookies);assert.deepEqual(s.calls.revoke,[s.tokens.accessToken]);assert.equal(s.values.size,0);
});
