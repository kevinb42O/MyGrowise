// Real mail workspace; synthetic jobs; mail POSTs are intercepted, never delivered.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/admin-mail-browser.mjs
import {writeFile,unlink,mkdir} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=new URL('../src/pages/audit-mail-browser-fixture.astro',import.meta.url);
const output='/tmp/mygrowise-mail-workspace';
let origin='http://127.0.0.1:4356';
let browser,server,ownsFixture=false,release;
try {
 await writeFile(fixture,`---
import AdminLayout from '../layouts/AdminLayout.astro';
import AdminMailWorkspace from '../components/admin/AdminMailWorkspace.astro';
import {ADMIN_MAIL_QUEUES,ADMIN_MAIL_STATES,mailTitle,emptyMailStates,selectedMailQueue} from '../lib/adminMail';
if(!import.meta.env.DEV)return new Response(null,{status:404});
const user={sub:'11111111-1111-4111-8111-111111111111',name:'Mailcontrole',roles:['super_admin'],practitionerId:null};
Astro.locals.currentUser=user;Astro.locals.adminUser=user;
const state=Astro.url.searchParams.get('status')||'sent';
const status=ADMIN_MAIL_STATES.some(s=>s.value===state)?state:'sent';
const queue=selectedMailQueue(Astro.url.searchParams.get('queue')||'');
const all=Array.from({length:71},(_,i)=>{
 const category=ADMIN_MAIL_QUEUES[i%4];
 const status=i<62?'sent':i<65?'pending':i<67?'failed':i<69?'sending':'unconfirmed';
 const kind=category.table==='booking_mail_jobs'?'confirmation':category.table==='commerce_mail_jobs'?'created':category.table==='support_mail_jobs'?'reply':'purchase_access';
 return {id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),queue:category.table,title:mailTitle(category.table,kind),category:category.label,recipient_name:'Noor Voorbeeld',recipient_email:'noor.voorbeeld@example.invalid',client_name:'Noor Voorbeeld',recipient_source:'snapshot',status,created_at:'2026-11-17T10:00:00Z',sent_at:'2026-11-18T10:00:00Z',next_attempt_at:'2026-11-20T09:00:00Z',lease_until:i===68?'2020-01-01T10:00:00Z':'2099-01-01T10:00:00Z',attempts:status==='failed'?6:1,diagnosis:status==='unconfirmed'?'Voor deze historische taak is succesvolle verzending niet bevestigd.':status==='failed'?'Verzenden mislukt. Controleer de mailconfiguratie.':'Geen aanvullende foutcode geregistreerd.'};
}).filter(()=>!Astro.url.searchParams.has('empty'));
const counts=ADMIN_MAIL_QUEUES.map(category=>{const states=emptyMailStates();for(const row of all.filter(j=>j.queue===category.table))states[row.status]++;return {table:category.table,label:category.label,states};});
const selected=all.filter(job=>job.status===status&&(!queue||job.queue===queue.table));
const pages=Math.max(1,Math.ceil(selected.length/25));
const page=Math.min(pages,Math.max(1,Number(Astro.url.searchParams.get('pagina'))||1));
const result={queue,status,items:selected.slice((page-1)*25,page*25),page,pages,total:selected.length,pageSize:25};
---
<AdminLayout title="Mailopvolging"><AdminMailWorkspace counts={counts} result={result as any} ready={!Astro.url.searchParams.has('unconfigured')} processed={Astro.url.searchParams.has('processed')} processingError={Astro.url.searchParams.has('error')}/></AdminLayout>
`,{flag:'wx'});ownsFixture=true;
 for(const port of [4321,4322]){try{const candidate='http://127.0.0.1:'+port;if((await fetch(candidate+'/audit-mail-browser-fixture',{signal:AbortSignal.timeout(1500)})).ok){origin=candidate;break;}}catch{}}
 if(origin.endsWith(':4356'))server=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--host','127.0.0.1','--port','4356'],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
 let logs='';server?.stdout.on('data',data=>logs+=data);server?.stderr.on('data',data=>logs+=data);
 for(let i=0;i<90;i++){try{if((await fetch(origin+'/audit-mail-browser-fixture')).ok)break;}catch{}if(i===89)throw new Error(logs);await new Promise(resolve=>setTimeout(resolve,500));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
 await context.route('**/api/internal/**',route=>route.fulfill({json:{items:[],unavailable:[],notifications:[],unreadCount:0,results:[]}}));
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 const go=query=>page.goto(origin+'/audit-mail-browser-fixture'+(query?'?'+query:''));
 await mkdir(output,{recursive:true});
 await go();await page.waitForSelector('.mail-workspace[data-enhanced]');
 await page.screenshot({path:output+'/initial-desktop.png',fullPage:true});
 assert.equal(await page.locator('.mail-job').count(),25);
 assert.equal(await page.getByLabel('Categorie',{exact:true}).inputValue(),'');
 assert.equal(await page.locator('.mail-status[aria-current]').innerText(),'Verzonden\n62');
 assert.equal(await page.locator('.mail-job__recipient-name').first().innerText(),'Noor Voorbeeld');
 assert.equal(await page.locator('.mail-job__recipient-email').first().innerText(),'noor.voorbeeld@example.invalid');
 assert.equal(await page.locator('.mail-job__reference').first().isVisible(),false);
 assert.equal(await page.locator('.mail-job').first().boundingBox().then(b=>b.y<500),true);
 const disclosure=page.locator('[data-mail-disclosure] summary').first();
 await disclosure.focus();await page.keyboard.press('Enter');
 await page.waitForSelector('[data-mail-disclosure][open] summary[aria-expanded="true"]');
 assert.equal(await disclosure.getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('.mail-job__detail-body').first().isVisible(),true);
 await disclosure.press('Enter');
 await page.getByLabel('Categorie',{exact:true}).selectOption('booking_mail_jobs');
 await page.waitForURL('**queue=booking_mail_jobs');
 assert.equal(await page.locator('.mail-status[aria-current]').innerText(),'Verzonden\n15');
 assert.equal(await page.locator('.mail-job').count(),15);
 assert.ok((await page.locator('.mail-job__category').allTextContents()).every(text=>text==='Afspraken'));
 await page.goBack();await page.waitForURL(url=>!url.searchParams.has('queue'));
 assert.equal(await page.getByLabel('Categorie',{exact:true}).inputValue(),'');
 await page.getByRole('link',{name:/Volgende/}).click();await page.waitForURL('**pagina=2*');
 assert.equal(await page.locator('.mail-job').count(),25);
 await page.locator('.mail-statuses__primary a').filter({hasText:'Mislukt'}).click();
 assert.equal(new URL(page.url()).searchParams.has('pagina'),false);
 assert.equal(await page.locator('.mail-job').count(),2);
 await page.locator('[data-mail-disclosure] summary').first().click();
 assert.equal(await page.locator('.mail-retry').first().isVisible(),true);
 let postCount=0;
 await context.route('**/api/admin/mail',async route=>{
  postCount++;const data=new URLSearchParams(route.request().postData());
  assert.equal(data.get('retry_failed'),'1');assert.equal(data.get('checked'),'yes');assert.ok(data.get('queue'));assert.ok(data.get('job_id'));
  await route.fulfill({status:303,headers:{location:'/audit-mail-browser-fixture?status=failed&processed=1'},body:''});
 });
 let retry=page.locator('.mail-retry').first();await retry.getByRole('button').click();
 assert.equal(postCount,0,'native checkbox validation blocks retry');
 await retry.locator('input[type=checkbox]').check();
 const guard=await retry.evaluate(form=>{
  form.addEventListener('submit',event=>event.preventDefault(),{once:true});
  form.requestSubmit();
  return {busy:form.getAttribute('aria-busy'),disabled:form.querySelector('button').disabled,blocked:!form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))};
 });
 assert.deepEqual(guard,{busy:'true',disabled:true,blocked:true});assert.equal(postCount,0);
 await go('status=failed');await page.locator('[data-mail-disclosure] summary').first().click();
 retry=page.locator('.mail-retry').first();await retry.locator('input[type=checkbox]').check();
 await Promise.all([page.waitForURL('**processed=1'),retry.getByRole('button').click()]);
 assert.equal(postCount,1);
 assert.match(await page.locator('.mail-notice').innerText(),/verzendronde is uitgevoerd/);
 await go('status=sending');
 assert.equal(await page.locator('.mail-job__time--warning').innerText(),'Verwerking onderbroken');
 await page.locator('.mail-more > summary').click();
 await page.getByRole('link',{name:/Overgeslagen of onbevestigd/}).click();
 assert.match(await page.locator('.mail-more > summary').innerText(),/Overgeslagen of onbevestigd/);
 assert.match(await page.locator('.mail-context').innerText(),/tellen niet mee/);
 await go('empty=1');assert.equal(await page.locator('.mail-empty h2').innerText(),'Nog geen verzonden e-mails');
 await go('unconfigured=1');assert.match(await page.getByRole('alert').innerText(),/niet volledig ingesteld/);
 await go('error=1');assert.match(await page.getByRole('alert').innerText(),/niet volledig afgerond/);
 await go();await page.getByText('Beheeracties',{exact:true}).click();
 assert.equal(await page.locator('.mail-actions__panel').isVisible(),true);
 await page.getByText('Alle mislukte taken opnieuw klaarzetten',{exact:true}).click();
 assert.match(await page.locator('.mail-actions__retry p').innerText(),/alle categorieën/);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.mail-actions__panel').isVisible(),false);
 await page.screenshot({path:output+'/desktop.png',fullPage:true});
 for(const width of [320,390,768,1100]){
  await page.setViewportSize({width,height:900});await go();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no overflow at '+width);
  for(const target of await page.locator('.mail-statuses__primary a, .mail-job__details > summary, #mail-category').all())assert.ok((await target.boundingBox()).height>=44,'touch target at '+width);
  if(width===390)await page.screenshot({path:output+'/mobile.png',fullPage:true});
 }
 await page.setViewportSize({width:720,height:500});await go();await page.evaluate(()=>document.documentElement.style.zoom='2');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'200% zoom fits');
 await context.close();
 const noScript=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 await noScript.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
 const native=await noScript.newPage();await native.goto(origin+'/audit-mail-browser-fixture');
 await native.locator('[data-mail-disclosure] summary').first().click();assert.equal(await native.locator('.mail-job__detail-body').first().isVisible(),true);
 assert.equal(await native.getByRole('button',{name:'Toepassen'}).isVisible(),true);
 await native.getByLabel('Categorie',{exact:true}).selectOption('booking_mail_jobs');
 await native.getByRole('button',{name:'Toepassen'}).click();await native.waitForURL('**queue=booking_mail_jobs');
 assert.equal(await native.locator('.mail-job').count(),15);
 await noScript.close();assert.deepEqual(errors,[]);
 console.log('PASS mail workspace: scoped counts, all-category pagination, filters/back, keyboard disclosures, guarded retries, extra statuses, empty/error states, mobile widths, 200% zoom and no-JS fallback.');
 console.log('Screenshots: '+output);
} finally {release?.();await browser?.close();if(server)spawnSync(process.execPath,['node_modules/astro/bin/astro.mjs','dev','stop'],{cwd:new URL('..',import.meta.url),stdio:'pipe'});if(ownsFixture)await unlink(fixture).catch(()=>{});}
