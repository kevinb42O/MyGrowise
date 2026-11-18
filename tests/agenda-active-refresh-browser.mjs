// Real calendar UI with synthetic API responses; no account/database writes.
import {writeFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=new URL('../src/pages/audit-agenda-refresh-fixture.astro',import.meta.url);
let browser,created=false;
try{
 await writeFile(fixture,`---
import UnifiedAgenda from '../components/admin/UnifiedAgenda';
import '../styles/admin.css';
import '../styles/practice-management.css';
import '../styles/practice-improvements.css';
import '../styles/agenda-workspace.css';
if(!import.meta.env.DEV)return new Response(null,{status:404});
---
<html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body class="admin-body practice-body agenda-workspace"><main class="admin-main practice-main" style="height:100vh"><div class="admin-page agenda-page"><UnifiedAgenda mode="practice" allowItransform={true} client:only="react" /></div></main></body></html>`,{flag:'wx'});created=true;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();await page.clock.install();const errors=[];page.on('dialog',dialog=>dialog.accept());page.on('pageerror',e=>errors.push(e.message));
 let reads=0;let lastAttempt=Date.now();let backoff=false;
 await context.route('**/api/praktijk/agenda**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.has('offers'))return route.fulfill({json:{offers:[]}});
  reads++;lastAttempt=await page.evaluate(()=>Date.now());
  const pending=reads<3;const from=url.searchParams.get('from').slice(0,10);
  await route.fulfill({json:{canUseItransform:true,availabilityUnknown:false,sync:{enabled:true,lastSuccessAt:new Date(lastAttempt).toISOString(),lastError:backoff?'feed_unavailable_or_invalid':null,pendingMissing:pending?1:0,coverageUncertain:0,coverageUntil:'2030-01-01T00:00:00Z',nextCheckAt:new Date(lastAttempt+(backoff?900:60)*1000).toISOString(),retryAfterSeconds:backoff?900:60},events:pending?[{id:'synthetic-event',source:'itransform',externalSource:'mijndiad',title:'Synthetische afspraak',subtitle:'',startsAt:from+'T10:00:00Z',endsAt:from+'T11:00:00Z',status:'confirmed',kind:'appointment',location:'Online',color:'#2563eb',editable:false}]:[]}});
 });
 await page.goto((process.env.AGENDA_TEST_ORIGIN||'http://localhost:4321')+'/audit-agenda-refresh-fixture');
 await page.getByText('MijnDiAd · wijziging controleren',{exact:true}).waitFor();
 let initial=reads;await page.clock.fastForward(58000);assert.equal(reads,initial);
 await Promise.all([page.waitForResponse(r=>r.url().includes('/api/praktijk/agenda?from=')),page.clock.fastForward(3500)]);await page.clock.runFor(100);
 assert.equal(reads,initial+1,'first minute refresh');
 await page.locator('.agenda-toolbar__create > summary').click();await page.getByRole('button',{name:'Eigen moment',exact:true}).click();await page.getByLabel('Titel',{exact:true}).fill('Onopgeslagen concept');
 await Promise.all([page.waitForResponse(r=>r.url().includes('/api/praktijk/agenda?from=')),page.clock.fastForward(61000)]);await page.getByText('MijnDiAd · bijgewerkt',{exact:true}).waitFor();assert.equal(reads,initial+2,'second minute confirms disappearance');assert.equal(await page.getByLabel('Titel',{exact:true}).inputValue(),'Onopgeslagen concept');await page.getByRole('button',{name:'Sluiten',exact:true}).click();
 await page.getByText('MijnDiAd · bijgewerkt',{exact:true}).click();
 await page.getByText(/ongeveer elke minuut/).waitFor();
 await page.screenshot({path:'/tmp/mygrowise-diad-refresh-desktop.png',fullPage:true});
 // Focus/visibility must not fetch while hidden, and return must refresh.
 await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}));
 initial=reads;await page.clock.fastForward(125000);assert.equal(reads,initial,'hidden agenda performs no API work');
 backoff=true;
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByText('MijnDiAd · controleren',{exact:true}).waitFor();initial=reads;
 await page.clock.fastForward(61000);assert.equal(reads,initial,'source backoff prevents minute polling during an outage');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByText(/met extra wachttijd/).waitFor();await page.getByRole('button',{name:'Nu verversen',exact:true}).scrollIntoViewIfNeeded();const refreshButton=await page.getByRole('button',{name:'Nu verversen',exact:true}).boundingBox();assert.ok(refreshButton.y+refreshButton.height<=844,'refresh action stays reachable on mobile');await page.screenshot({path:'/tmp/mygrowise-diad-refresh-mobile.png',fullPage:true});
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: minute refresh, automatic second snapshot, preserved unsaved input, hidden-tab pause, immediate return refresh, outage backoff, desktop/mobile rendering and no browser errors.');
 await context.close();
}finally{await browser?.close();if(created)await unlink(fixture);}
