// Explicit integration check: creates and removes one synthetic Supabase account; sends no mail.
// AUTH_TEST_ORIGIN=https://www.mygrowise.be PLAYWRIGHT_MODULE=/path/to/playwright node tests/auth-session-http.mjs
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../package.json',import.meta.url));
require('dotenv').config({quiet:true});
const origin=process.env.AUTH_TEST_ORIGIN || 'http://localhost:4321';
const {createClient}=require('@supabase/supabase-js');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.env.PUBLIC_SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`session-check-${Date.now()}@example.invalid`,password=`Session-${crypto.randomUUID()}!`;
let id;const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
try {
 for(const width of [1440,390]) {
  const ctx=await browser.newContext({viewport:{width,height:1000}});const page=await ctx.newPage();
  for(const route of ['/praktijk/login','/admin/login','/account/inloggen']) {
   await page.goto(origin+route);const checkbox=page.getByRole('checkbox',{name:'Ingelogd blijven op dit toestel'});
   await checkbox.waitFor();assert.equal(await checkbox.isChecked(),false);await checkbox.check();assert.equal(await checkbox.isChecked(),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
   const box=await checkbox.boundingBox();assert.equal(Math.round(box.width),18);
   if(route==='/praktijk/login')await page.screenshot({path:`/tmp/mygrowise-login-${width}.png`,fullPage:true});
  }await ctx.close();
 }
 console.log('PASS: three login screens, desktop and mobile, accessible unchecked checkbox, no horizontal overflow');
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Synthetic session verification'}});if(created.error)throw created.error;id=created.data.user.id;
 const role=await admin.from('user_roles').upsert({user_id:id,role:'customer'},{onConflict:'user_id,role'});if(role.error)throw role.error;
 for(const remember of [false,true]) {
  let ctx=await browser.newContext();let page=await ctx.newPage();await page.goto(origin+'/account/inloggen');
  await page.getByLabel('E-mailadres',{exact:true}).fill(email);await page.getByLabel('Wachtwoord',{exact:true}).fill(password);
  if(remember)await page.getByRole('checkbox',{name:'Ingelogd blijven op dit toestel'}).check();
  const loginResult=page.waitForResponse(r=>r.url().includes('/api/account/login'));
  await page.getByRole('button',{name:'Inloggen',exact:true}).click();
  const loginResponse=await loginResult;assert.equal(loginResponse.status(),303);
  await page.waitForURL('**/account');
  assert.equal(new URL(page.url()).pathname,'/account');
  let cookies=await ctx.cookies();const auth=cookies.filter(c=>['mg_session','mg_refresh','mg_remember'].includes(c.name));assert.equal(auth.length,3);assert.ok(auth.every(c=>c.httpOnly));assert.ok(auth.every(c=>remember?c.expires>Date.now()/1000+29*86400:c.expires===-1));
  const access=auth.find(c=>c.name==='mg_session');const parts=access.value.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url'));payload.exp=Math.floor(Date.now()/1000)-7200;parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');
  await ctx.addCookies([{...access,value:parts.join('.')}]);
  // Concurrent requests use the same real Supabase refresh token (rotation reuse protection).
  const responses=await Promise.all([ctx.request.get(origin+'/account'),ctx.request.get(origin+'/account')]);assert.ok(responses.every(r=>r.status()===200&&new URL(r.url()).pathname==='/account'));
  cookies=await ctx.cookies();assert.notEqual(cookies.find(c=>c.name==='mg_session').value,parts.join('.'));assert.ok(cookies.filter(c=>c.name.startsWith('mg_')).every(c=>remember?c.expires>0:c.expires===-1));
  const state=await ctx.storageState();const refresh=cookies.find(c=>c.name==='mg_refresh').value;
  if(remember){await ctx.close();ctx=await browser.newContext({storageState:state});page=await ctx.newPage();await page.goto(origin+'/account');assert.equal(new URL(page.url()).pathname,'/account');}
  const response=await ctx.request.post(origin+'/api/account/logout',{form:{},maxRedirects:0});assert.equal(response.status(),303);assert.equal((await ctx.cookies()).filter(c=>['mg_session','mg_refresh','mg_remember'].includes(c.name)).length,0);
  const publicClient=createClient(url,process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const replay=await publicClient.auth.refreshSession({refresh_token:refresh});assert.ok(replay.error,'logout must revoke refresh token on Supabase');
  await ctx.close();console.log(`PASS: real login remember=${remember}, cookie policy, expired token recovery, concurrent tabs, ${remember?'restored browser, ':''}logout and revoked-token replay`);
 }
} finally {
 await browser.close();if(id){const result=await admin.auth.admin.deleteUser(id);if(result.error)throw result.error;console.log('PASS: synthetic account removed');}
}
