// Synthetic data only. Requires a running local Astro server.
import { createRequire } from 'node:module';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixturePath = new URL('../src/pages/client-search-browser-fixture.astro', import.meta.url);
writeFileSync(fixturePath, `---
import AdminLayout from '../layouts/AdminLayout.astro';
import PracticeLayout from '../layouts/PracticeLayout.astro';
if(!import.meta.env.DEV)return new Response(null,{status:404});
const user={sub:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid',name:'Testgebruiker',roles:['super_admin'],practitionerId:null,emailConfirmed:true,issuedAt:0,expiresAt:99999999999};
Astro.locals.adminUser=user; Astro.locals.currentUser=user;
const Layout=Astro.url.searchParams.has('practice')?PracticeLayout:AdminLayout;
---
<Layout title="Cliëntendossiers"><div style="padding:32px"><h1>Cliëntendossiers</h1><p>Synthetische testomgeving</p></div></Layout>
<style is:global>astro-dev-toolbar{display:none!important}</style>`, { flag:'wx' });
const browser = await chromium.launch({headless:true,channel:'chrome'});
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let fail = false;
let delay = 0;
let recentCleared = false;
const clients = [
 {id:'22222222-2222-4222-8222-222222222222',name:'Zoë Paarden',email:'zoe@example.invalid',status:'active'},
 {id:'33333333-3333-4333-8333-333333333333',name:'Stefanie Paarden',email:'stefanie@example.invalid',status:'active'},
 {id:'44444444-4444-4444-8444-444444444444',name:'Alexandra Een bijzonder lange samengestelde achternaam',email:'een.bijzonder.lang.emailadres@example.invalid',status:'archived'}];
await context.route('**/api/**', async route => {
 if(!route.request().url().endsWith('/api/admin/clienten/zoeken')) return route.fulfill({json:{items:[],notifications:[],unread:0}});
 const form=new URLSearchParams(route.request().postData());
 const term=form.get('search')||'';
 if(form.get('clear_recent')==='1') recentCleared=true;
 if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
 if(fail) return route.fulfill({status:503,json:{error:'unavailable'}});
 const found=term==='niemand'?[]:term==='zoe'?[clients[0]]:clients.filter(x=>form.get('include_archived')==='1'||x.status==='active');
 await route.fulfill({json:{clients:(!term && recentCleared)?[]:found,hasMore:term==='paarden'}}).catch(()=>{});
});
mkdirSync('output/client-search',{recursive:true});
try {
 for (const practice of [false,true]) {
  for(const width of [1440,768,390,320]) {
   await page.setViewportSize({width,height:900});
   await page.goto(`http://localhost:4321/client-search-browser-fixture${practice?'?practice=1':''}`);
   const input=page.getByRole('combobox');
   await input.fill('paarden');
   const panel=page.getByRole('dialog',{name:'Cliënten zoeken'});
   await page.waitForFunction(()=>document.querySelector('.client-search__results')?.getAttribute('aria-busy')==='false');
   await panel.getByLabel('Ook gearchiveerde dossiers').check();
   await page.waitForFunction(()=>document.querySelector('.client-search__results')?.getAttribute('aria-busy')==='false');
   assert.equal(await page.locator('[data-client-result]').count(),3);
   const box=await panel.boundingBox();
   assert.ok(box.x>=0 && box.x+box.width<=width,JSON.stringify({width,practice,box}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.ok((await panel.getByText('Bekijk alle resultaten').getAttribute('href')).includes('q=paarden&status=all'));
   assert.ok((await panel.getByRole('link',{name:'Afspraken van Zoë Paarden'}).getAttribute('href')).includes('?onderdeel=afspraken'));
   await page.screenshot({path:`output/client-search/${practice?'practice':'admin'}-${width}.png`});
   await input.focus(); await input.press('ArrowDown');
   assert.equal(await page.locator('[data-client-result]').first().evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('ArrowDown');
   assert.equal(await page.locator('[data-client-result]').nth(1).evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('Escape');
   await panel.waitFor({state:'hidden'});
   assert.equal(await input.inputValue(),'paarden');
  }
 }
 const input=page.getByRole('combobox');
 await page.keyboard.press((await page.evaluate(()=>/Mac/.test(navigator.platform)))?'Meta+k':'Control+k');
 assert.equal(await input.evaluate(e=>e===document.activeElement),true);
 await page.getByRole('dialog',{name:'Cliënten zoeken'}).waitFor();
 await page.getByRole('button',{name:'Zoekopdracht wissen'}).click();
 await page.getByText('Recent geopende dossiers',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.client-search__results')?.getAttribute('aria-busy')==='false');
 await page.getByRole('button',{name:'Recente lijst wissen'}).click();
 await page.getByText('Nog geen recente dossiers',{exact:true}).waitFor();
 await input.fill('niemand');
 await page.getByText('Geen cliënten gevonden voor ‘niemand’',{exact:true}).waitFor();
 await page.screenshot({path:'output/client-search/empty-320.png'});
 fail=true; await input.fill('fout');
 await page.getByText('Zoeken tijdelijk niet beschikbaar',{exact:true}).waitFor();
 fail=false; await page.getByRole('button',{name:'Opnieuw zoeken'}).click();
 await page.locator('[data-client-result]').first().waitFor();
 delay=800; await input.fill('zoe');
 await page.waitForTimeout(40);
 assert.equal(await page.locator('.client-search__results ul').getAttribute('inert'),'');
 await input.press('ArrowDown');
 assert.equal(await input.evaluate(e=>e===document.activeElement),true);
 await page.waitForFunction(()=>document.querySelector('.client-search__results')?.getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('[data-client-result]').count(),1);
 // Verify Enter navigates directly when there is exactly one result, without loading a real dossier.
 await page.route('**/praktijk/clienten/*',route=>route.fulfill({body:'Dossier geopend'}));
 await input.press('Enter'); await page.waitForURL('**/praktijk/clienten/22222222-2222-4222-8222-222222222222');
 assert.deepEqual(errors,[]);
 console.log('Client search browser: admin/practice at 1440/768/390/320, overflow, highlighting, links, keyboard, shortcut, query/recent clearing, empty/error/retry, stale-result protection and Enter passed.');
} finally { await browser.close(); unlinkSync(fixturePath); }
