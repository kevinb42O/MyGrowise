// Real admin components, synthetic data and intercepted module APIs. No DB or mail mutations.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/admin-audit-browser.mjs
import {readFile,writeFile,unlink,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=new URL('../src/pages/audit-admin-browser-fixture.astro',import.meta.url);
const output='/tmp/mygrowise-admin-audit-fixes';
let origin=process.env.MYGROWISE_AUDIT_ORIGIN||'http://127.0.0.1:4347';
let browser,server,ownsFixture=false;
try {
 const appointmentSource=await readFile(new URL('../src/pages/admin/afspraaktypes.astro',import.meta.url),'utf8');
 const appointmentScript=appointmentSource.match(/<script>([\s\S]*?)<\/script>/)[1];
 await writeFile(fixture,`---
import AdminLayout from '../layouts/AdminLayout.astro';
import ContentForm from '../components/admin/ContentForm.astro';
import {submitContentForm} from '../lib/adminContentForm';
import ProductForm from '../components/admin/ProductForm.astro';
import ModuleEditor from '../components/modules/ModuleEditor.astro';
import AdminMailSummary from '../components/admin/AdminMailSummary.astro';
import AdminMailTasks from '../components/admin/AdminMailTasks.astro';
import {ADMIN_MAIL_QUEUES} from '../lib/adminMail';
import AdminPagination from '../components/admin/AdminPagination.astro';
import '../styles/catalog-admin.css';
import '../styles/modules.css';
if (!import.meta.env.DEV) return new Response(null,{status:404});
const user={sub:'11111111-1111-4111-8111-111111111111',name:'Auditcontrole',roles:['super_admin'],practitionerId:null};
Astro.locals.currentUser=user;Astro.locals.adminUser=user;
const view=Astro.url.searchParams.get('view')||'mail';
let submission=null;
if(Astro.request.method==='POST'){
 const values=await Astro.request.clone().formData();
 // This fixture may only exercise a known validation error; valid writes are forbidden.
 if(values.get('kind')!=='page'||values.get('slug')!=='admin')return new Response('Test only',{status:403});
 submission=await submitContentForm(Astro.request,user as any);
 Astro.response.status=submission.status;
}

const current={product:{id:'test-module',title:'Testmodule',slug:'testmodule',type:'module',summary:'Een volledige omschrijving voor de controle.',status:'draft',availability:'upcoming',image:'/images/editorial/mygrowise-50.jpg',priceCents:8900},module:{revision:7,number:1,subtitle:'Inzicht',tagline:'',introduction:['Een inleiding'],topics:['Rust'],audience_text:'Volwassenen',access_text:'Online toegang',support_text:'Zelfstandig',image_alt:'Cover',current_release_id:null},draft:{id:'release',revision:3},assets:[{id:'asset-1',title:'Werkboek',kind:'pdf',status:'verified',byte_size:100,sort_order:1}],recommendationOptions:[{id:'recommendation',title:'Verdieping',status:'draft',availability:'upcoming'}],recommendations:[],releases:[]};
---
<AdminLayout title="Admincontrole"><div class="admin-page"><h1>Admincontrole</h1>
{view==='mail'&&<><AdminMailSummary counts={[{table:'booking_mail_jobs',label:'Afspraken',states:{pending:2,sending:0,failed:1,sent:83,unconfirmed:2}},{table:'commerce_mail_jobs',label:'Bestellingen en afnames',states:{pending:0,sending:1,failed:0,sent:14,unconfirmed:1}}]}/><AdminMailTasks result={{queue:ADMIN_MAIL_QUEUES[0],status:'sent',items:[{id:'11111111-1111-4111-8111-111111111111',created_at:'2026-11-17T10:00:00Z',sent_at:'2026-11-18T10:00:00Z',attempts:1,status:'sent',diagnosis:''}],page:2,pages:4,total:83,pageSize:25}}/></>}
{view==='content'&&<ContentForm draft={submission?.draft} error={submission?.error} action="/audit-admin-browser-fixture?view=content" canPublish={true}/>}
{view==='product'&&<ProductForm action="/unused" submitLabel="Aanmaken"/>}
{view==='book-product'&&<ProductForm product={{id:'book',type:'guide',title:'Bestaand boek',slug:'boek',summary:'Een voldoende lange omschrijving',status:'draft'}} action="/unused" submitLabel="Bewaren"/>}
{view==='module'&&<ModuleEditor current={current as any} origin="https://example.invalid"/>}
{view==='appointment'&&<form id="appointment"><label>Groep<select data-group name="group_id"><option value="">Nieuwe groep</option><option value="group-a" data-color="#173d35">Groep A</option><option value="group-b" data-color="#b42318">Groep B</option></select></label><label>Kleur<input type="color" name="color" data-color value="#000000"/></label></form>}
</div></AdminLayout>
<script>${appointmentScript}
document.documentElement.dataset.appointmentReady='true';</script>
`,{flag:'wx'});ownsFixture=true;
 if(!process.env.MYGROWISE_AUDIT_ORIGIN){for(const port of [4321,4322]){try{const candidate=`http://127.0.0.1:${port}`;if((await fetch(candidate+'/audit-admin-browser-fixture',{signal:AbortSignal.timeout(1500)})).ok){origin=candidate;break;}}catch{}}}
 if(!process.env.MYGROWISE_AUDIT_ORIGIN&&origin.endsWith(':4347'))server=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--host','127.0.0.1','--port','4347'],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
 let logs='';server?.stdout.on('data',data=>logs+=data);server?.stderr.on('data',data=>logs+=data);
 for(let i=0;i<90;i++){try{if((await fetch(origin+'/audit-admin-browser-fixture')).ok)break;}catch{}if(i===89)throw new Error(logs);await new Promise(resolve=>setTimeout(resolve,500));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
 await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
 await context.route('**/api/internal/**',route=>route.fulfill({json:{items:[],unavailable:[],notifications:[],unreadCount:0,results:[]}}));
 let holdSave=null;
 await context.route('**/api/admin/modules/**',async route=>{if(holdSave&&route.request().url().endsWith('/save'))await holdSave;assert.equal(route.request().method(),'POST');await route.fulfill({json:{}});});
 const go=view=>page.goto(origin+'/audit-admin-browser-fixture?view='+view);
 await mkdir(output,{recursive:true});
 await go('appointment');await page.waitForFunction(()=>document.documentElement.dataset.appointmentReady==='true');await page.locator('[data-group]').selectOption('group-b');
 assert.equal(await page.locator('input[data-color]').inputValue(),'#b42318');
 assert.equal(await page.locator('option').nth(1).getAttribute('value'),'group-a');
 await page.locator('[data-group]').selectOption('group-a');
 assert.equal(await page.locator('input[data-color]').inputValue(),'#173d35');
 assert.equal(await page.locator('[data-group]').inputValue(),'group-a');
 console.log('PASS group selection changes color without corrupting group IDs');
 await go('product');assert.deepEqual(await page.locator('select[name="type"] option').evaluateAll(options=>options.map(option=>option.value)),['ebook']);
 console.log('PASS generic creation cannot select an incomplete specialized type');
 await go('book-product');assert.deepEqual(await page.locator('select[name="type"] option').evaluateAll(options=>options.map(option=>option.value)),['guide']);
 console.log('PASS existing product type cannot be changed into an incompatible editor');
 await go('module');await page.waitForFunction(()=>document.querySelector('[data-module-save]')?.dataset.editorKey);assert.equal(await page.locator('[data-upload-pause]').isVisible(),false);await page.locator('[data-module-save] input[name="title"]').fill('Niet-opgeslagen websitetekst');
 await page.locator('[data-module-recommendations] input[type="checkbox"]').check();
 await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Verdieping bewaren',exact:true}).click()]);
 assert.equal(await page.locator('[data-module-save] input[name="title"]').inputValue(),'Niet-opgeslagen websitetekst');
 assert.equal(await page.locator('[data-module-save] input[name="revision"]').inputValue(),'7');
 assert.match(await page.locator('[data-module-error]').innerText(),/teruggezet/);
 await page.screenshot({path:output+'/module-restored-desktop.png',fullPage:true});
 console.log('PASS saving another module section preserves dirty text across reload with current revisions');
 // A selected file must never disappear as a side effect of another section's save.
 await page.locator('[data-module-upload] input[type="file"]').setInputFiles({name:'werkboek.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\ntest')});
 await page.getByRole('button',{name:'Verdieping bewaren',exact:true}).click();
 assert.match(await page.locator('[data-module-error]').innerText(),/Upload het gekozen bestand eerst/);
 assert.equal(await page.locator('[data-module-upload] input[type="file"]').evaluate(input=>input.files.length),1);
 console.log('PASS unsaved file selection blocks unrelated reload actions');
 await page.locator('[data-module-upload] input[type="file"]').setInputFiles([]);
 let releaseSave;holdSave=new Promise(resolve=>{releaseSave=resolve;});
 const sent=page.waitForRequest(request=>request.url().endsWith('/save'));
 await page.getByRole('button',{name:'Website-inhoud bewaren',exact:true}).click();await sent;
 await page.locator('[data-module-save] input[name="title"]').fill('Tijdens de opslag verder geschreven');
 const reloaded=page.waitForEvent('load');releaseSave();await reloaded;holdSave=null;
 assert.equal(await page.locator('[data-module-save] input[name="title"]').inputValue(),'Tijdens de opslag verder geschreven');
 console.log('PASS text typed during an in-flight save survives the reload');

 page.on('dialog',dialog=>dialog.accept());
 await page.setViewportSize({width:390,height:844});await go('mail');
 for(const head of await page.locator('.admin-table thead').all())assert.equal(await head.isVisible(),false);
 for(const cell of await page.locator('.admin-table td').all())assert.ok(await cell.getAttribute('data-label'));
 const planned=page.locator('td[data-label="Gepland of wachtend"]').first();
 assert.equal(await planned.evaluate(el=>getComputedStyle(el,'::before').content),'"Gepland of wachtend"');
 for(const label of ['Gepland of wachtend','Bezig','Mislukt','Verzonden','Overgeslagen of onbevestigd'])assert.notEqual(await page.locator(`td[data-label="${label}"]`).first().evaluate(el=>getComputedStyle(el,'::before').display),'none');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:output+'/mail-mobile.png',fullPage:true});
 console.log('PASS mobile table retains status labels with no page overflow');
 assert.match(await page.locator('td[data-label="Verzonden op"]').innerText(),/11:00/);
 assert.equal(await page.locator('#mailtaken button').count(),1);
 assert.equal(await page.locator('#mailtaken td[data-label="Planning"], #mailtaken td[data-label="Herstel"]').count(),0);
 const sentLink=page.locator('.admin-mail-summary td[data-label="Verzonden"] a').first();
 assert.equal(await sentLink.getAttribute('href'),'/admin/mail?queue=booking_mail_jobs&status=sent#mailtaken');
 await sentLink.focus();assert.equal(await sentLink.evaluate(el=>document.activeElement===el),true);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:output+'/mail-desktop.png',fullPage:true});
 console.log('PASS sent history timestamps, links and keyboard focus without retry controls');
 await page.setViewportSize({width:390,height:844});
 await go('content');const body=page.locator('textarea[name="body"]');assert.equal(await body.getAttribute('id'),'content-body');assert.equal(await body.evaluate(el=>getComputedStyle(el).fontSize),'16px');
 await page.getByLabel(/^Titel/).fill('Een zorgvuldig geschreven artikel');
 await body.fill('Inhoud die niet verloren mag gaan.');
 assert.equal(await page.locator('input[name="slug"]').inputValue(),'een-zorgvuldig-geschreven-artikel');
 const width=await page.locator('.content-editor button[type="submit"]').evaluate(el=>el.getBoundingClientRect().height);assert.ok(width>=44,JSON.stringify(await page.locator('.content-editor button[type="submit"]').evaluate(el=>({height:el.getBoundingClientRect().height,minHeight:getComputedStyle(el).minHeight,innerWidth,media:matchMedia('(max-width:760px)').matches,classes:document.body.className}))));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:output+'/content-mobile.png',fullPage:true});
 console.log('PASS content editor labels, slug generation, mobile targets and layout');
 const noScriptContext=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 await noScriptContext.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
 const noScriptPage=await noScriptContext.newPage();
 await noScriptPage.goto(origin+'/audit-admin-browser-fixture?view=content');
 await noScriptPage.locator('input[name="title"]').fill('Artikel zonder JavaScript');
 await noScriptPage.locator('input[name="slug"]').fill('admin');
 await noScriptPage.locator('select[name="kind"]').selectOption('page');
 await noScriptPage.locator('textarea[name="body"]').fill('Mijn lange tekst met <HTML> & tekens '.repeat(400));
 const navigation=noScriptPage.waitForNavigation();
 await noScriptPage.getByRole('button',{name:'Content aanmaken',exact:true}).click();
 assert.equal((await navigation).status(),422);
 assert.match(await noScriptPage.locator('[role="alert"]').innerText(),/gereserveerd/);
 assert.equal(await noScriptPage.locator('textarea[name="body"]').inputValue(),'Mijn lange tekst met <HTML> & tekens '.repeat(400));
 assert.equal(await noScriptPage.locator('input[name="title"]').inputValue(),'Artikel zonder JavaScript');
 await noScriptContext.close();
 console.log('PASS native content POST preserves long text on server rejection with JavaScript disabled');

 assert.deepEqual(errors,[]);
 console.log('Screenshots: '+output);
} finally {
 await browser?.close();server?.kill('SIGTERM');if(ownsFixture)await unlink(fixture).catch(()=>{});
}
