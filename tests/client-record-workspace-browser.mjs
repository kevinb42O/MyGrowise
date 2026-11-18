// Synthetic fixtures, real shared components, intercepted API calls. No database writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink, readFile, rmdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('..',import.meta.url);
const output=new URL('../.impeccable/review/clientendossiers/',import.meta.url);
let origin=process.env.MYGROWISE_AUDIT_ORIGIN||'http://127.0.0.1:4356';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const note='22222222-2222-4222-8222-222222222222';
const finalNote='33333333-3333-4333-8333-333333333333';
const fixtureDirs=['record-workspace-fixture','record-practice-fixture'].map(name=>new URL(`../src/pages/${name}/`,import.meta.url));
let browser,server;
const created=[];
try {
  for(const dir of fixtureDirs){
    await mkdir(dir,{recursive:true});
    const file=new URL('[id].astro',dir);
    await writeFile(file,`---
import ClientRecord from '../../components/records/ClientRecord.astro';
import { recordFixture } from '../../../tests/fixtures/client-record-workspace';
if (!import.meta.env.DEV) return new Response(null,{status:404});
const data=recordFixture(Astro.url);
Astro.locals.currentUser=data.user;Astro.locals.adminUser=data.user;
---
<ClientRecord data={data}/>
<style is:global>astro-dev-toolbar { display:none !important; }</style>
`,{flag:'wx'});created.push(file);
  }
  let logs='';
  if(!process.env.MYGROWISE_AUDIT_ORIGIN){
    for(const port of [4321,4322]){try{const candidate=`http://localhost:${port}`;if((await fetch(candidate,{method:'HEAD',signal:AbortSignal.timeout(3000)})).ok){origin=candidate;break;}}catch{}}
  }
  if(!process.env.MYGROWISE_AUDIT_ORIGIN&&origin.endsWith(':4356')){
    server=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--host','127.0.0.1','--port','4356'],{cwd:root,stdio:'pipe'});
    server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
  }
  for(let attempt=0;attempt<100;attempt++){
    try{const response=await fetch(`${origin}/record-workspace-fixture/${id}`);if(response.ok)break;if(attempt===99)throw new Error(await response.text());}catch(error){if(attempt===99)throw new Error(logs+'\n'+error);}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  // Keep offline QA deterministic; the app's system font fallback is exercised.
  await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  // Other local work may trigger Vite HMR; each QA navigation must remain stable.
  await context.routeWebSocket(/.*/,socket=>socket.close());
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const photo=await readFile(new URL('../public/images/practitioners/virginie-real.jpg',import.meta.url));
  let photoFails=false;
  await context.route('**/api/**',route=>{
    if(route.request().url().includes('/teamfoto/'))return photoFails?route.fulfill({status:404}):route.fulfill({body:photo,contentType:'image/jpeg'});
    return route.fulfill({json:{items:[],notifications:[],unreadCount:0,results:[]}});
  });
  const go=async(query='',practice=false)=>{await page.goto(`${origin}/${practice?'record-practice-fixture':'record-workspace-fixture'}/${id}${query}`);await page.locator('.header-client-search input').waitFor();};
  const capture=async options=>{await page.locator('.header-client-search input').waitFor();await page.evaluate(async()=>{document.activeElement?.blur();window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot(options);};
  await mkdir(output,{recursive:true});
  await go();
  await page.locator('.record-workspace').waitFor();
  assert.equal(await page.locator('.record-nav a').count(),4);
  assert.equal(await page.locator('.client-note').count(),1);
  assert.equal(await page.locator('form[data-note-form]:visible').count(),0);
  assert.equal(await page.getByRole('heading',{name:'Teamleden met toegang'}).count(),0);
  await capture({path:new URL('desktop.png',output).pathname,fullPage:true});
  await page.getByRole('link',{name:'Concept bewerken'}).click();
  await page.locator('[data-editor-ready] .record-editor__document').waitFor();
  assert.equal(await page.locator('.client-note__body > .client-note__content').count(),0);
  assert.equal(new URL(page.url()).searchParams.get('bewerken'),'1');
  await capture({path:new URL('draft-editor-desktop.png',output).pathname,fullPage:true});
  await page.getByRole('link',{name:'Terug naar verslag'}).click();
  await page.locator('.client-note__body > .client-note__content').waitFor();
  assert.equal(await page.locator('.client-note-edit').count(),0);
  await page.locator('.record-note-item').nth(1).click();
  await page.getByRole('heading',{name:'Intake — hulpvraag en verwachtingen'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('verslag'),finalNote);
  await page.reload();assert.equal(await page.locator('.client-note').count(),1);
  await page.goBack();await page.getByRole('heading',{name:'Sessie — ruimte voor herstel'}).waitFor();
  await page.locator('.record-new-note').click();
  await page.getByRole('heading',{name:'Nieuw verslag',exact:true}).waitFor();
  await page.locator('[data-editor-ready] .record-editor__document').waitFor();
  assert.equal(await page.locator('textarea[name="body"]').count(),1);
  await capture({path:new URL('editor-desktop.png',output).pathname,fullPage:true});
  await page.locator('input[name="title"]').fill('Synthetische nieuwe sessie');
  await page.getByRole('textbox',{name:'Verslag',exact:true}).fill('Niet-opgeslagen synthetische tekst.');
  // Native beforeunload must protect cross-section navigation; dismiss keeps text intact.
  let warned=false;
  page.once('dialog',async dialog=>{warned=dialog.type()==='beforeunload';await dialog.dismiss();});
  await page.locator('.record-nav a').nth(1).click({noWaitAfter:true});
  await page.waitForTimeout(250);
  assert.equal(warned,true);assert.equal(await page.locator('textarea[name="body"]').inputValue(),'Niet-opgeslagen synthetische tekst.');
  // A failed enhanced save retains the text and re-enables controls.
  await page.route('**/record-workspace-fixture/**',async route=>route.request().method()==='POST'?route.fulfill({status:422,json:{error:'Opslaan mislukt. Je tekst blijft hier staan.'}}):route.continue());
  await page.getByRole('button',{name:'Opslaan als concept'}).click();
  await page.locator('[data-note-status][role="alert"]').waitFor();
  assert.equal(await page.locator('textarea[name="body"]').inputValue(),'Niet-opgeslagen synthetische tekst.');
  assert.equal(await page.getByRole('button',{name:'Opslaan als concept'}).isEnabled(),true);
  // Real selection, toolbar commands, keyboard navigation and rich failed-save recovery.
  const editor=page.getByRole('textbox',{name:'Verslag',exact:true});
  await editor.fill('Een zorgvuldig verslag');await editor.press('ControlOrMeta+a');
  await page.getByRole('button',{name:'Vet',exact:true}).click();
  assert.equal(await editor.locator('strong').textContent(),'Een zorgvuldig verslag');
  assert.equal(await page.getByRole('button',{name:'Vet',exact:true}).getAttribute('aria-pressed'),'true');
  await editor.press('ControlOrMeta+i');
  assert.equal(await editor.locator('strong em,em strong').count(),1);
  await page.getByRole('button',{name:'Tussenkop',exact:true}).click();assert.equal(await editor.locator('h2').count(),1);
  await page.getByRole('button',{name:'Normale tekst',exact:true}).click();assert.equal(await editor.locator('h2').count(),0);
  await page.getByRole('button',{name:'Opsomming',exact:true}).click();assert.equal(await editor.locator('ul li').count(),1);
  await page.getByRole('button',{name:'Genummerde lijst',exact:true}).click();assert.equal(await editor.locator('ol li').count(),1);
  await page.getByRole('button',{name:'Ongedaan maken',exact:true}).click();assert.equal(await editor.locator('ul li').count(),1);
  await page.getByRole('button',{name:'Opnieuw',exact:true}).click();assert.equal(await editor.locator('ol li').count(),1);
  await page.getByRole('button',{name:'Vet',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('button',{name:'Cursief',exact:true}).evaluate(el=>el===document.activeElement),true);
  let submitted='';
  await page.route('**/record-workspace-fixture/**',async route=>{if(route.request().method()==='POST'){submitted=route.request().postData();return route.fulfill({status:409,json:{error:'Versieconflict. Je tekst blijft behouden.'}});}return route.continue();});
  const before=await page.locator('[name=body_document]').inputValue();
  await page.getByRole('button',{name:'Opslaan als concept'}).click();
  await page.getByText('Versieconflict. Je tekst blijft behouden.').waitFor();
  assert.ok(submitted.includes('orderedList'));assert.ok(submitted.includes('bold'));
  assert.equal(await page.locator('[name=body_document]').inputValue(),before);
  assert.equal(await editor.getAttribute('contenteditable'),'true');
  // Unsupported paste features are stripped by the schema; supported emphasis survives.
  await editor.fill('');await editor.evaluate(el=>{const data=new DataTransfer();data.setData('text/html','<p onclick="alert(1)"><strong>Veilig geplakt</strong><a href="javascript:alert(1)"> zonder link</a><img src="x" onerror="alert(1)"></p>');data.setData('text/plain','Veilig geplakt zonder link');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  assert.equal(await editor.locator('img,a,[onclick],[onerror]').count(),0);assert.equal(await editor.locator('strong').textContent(),'Veilig geplakt');
  await editor.fill('');await page.getByRole('button',{name:'Opslaan als concept'}).click();
  await page.getByText('Schrijf eerst de inhoud van je verslag.').waitFor();
  // Limits reject a large paste without discarding the preceding content.
  await editor.fill('Bewaarde tekst');await editor.press('ControlOrMeta+End');
  await editor.evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','x'.repeat(20001));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
  assert.equal(await page.locator('[name=body]').inputValue(),'Bewaarde tekst');
  await page.getByText('Deze wijziging is te groot.',{exact:false}).waitFor();
  page.once('dialog',dialog=>dialog.accept());
  await go('?onderdeel=toegang');
  await page.getByRole('heading',{name:'Teamleden met toegang'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-record-photo]')?.naturalWidth>0);
  assert.equal(await page.locator('.client-note').count(),0);
  assert.equal(await page.locator('.client-assignment-row').count(),1);
  await capture({path:new URL('access-desktop.png',output).pathname,fullPage:true});
  photoFails=true;await go('?onderdeel=toegang');
  await page.locator('[data-record-photo][hidden]').waitFor({state:'attached'});
  assert.equal(await page.locator('.record-staff-photo > span').textContent(),'V');
  photoFails=false;
  await go('#clientgegevens');
  await page.waitForURL('**onderdeel=gegevens');
  await page.getByRole('heading',{name:'Cliëntgegevens',exact:true}).waitFor();
  assert.equal(await page.locator('.record-notes').count(),0);
  await go(`?concept=${note}#verslag-${note}`);
  await page.locator('.client-note-edit').waitFor();
  await go(`?correctie=${finalNote}#nieuw-verslag`);
  await page.getByRole('heading',{name:'Aanvulling of correctie'}).waitFor();
  assert.equal(await page.locator('input[name="corrects_note_id"]').inputValue(),finalNote);
  await go('?onderdeel=afspraken&status=completed&van=2026-11-01');
  assert.equal(await page.locator('select[name="status"]').inputValue(),'completed');
  await page.getByRole('button',{name:'Filteren',exact:true}).click();
  assert.equal(new URL(page.url()).searchParams.get('onderdeel'),'afspraken');
  await capture({path:new URL('appointments-desktop.png',output).pathname,fullPage:true});
  // Every surface must fit narrow phones, tablets and a laptop with the admin sidebar.
  for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:width<500?844:1000});
    for(const [name,query] of [['list','?onderdeel=verslagen'],['editor','?onderdeel=verslagen&verslag=nieuw'],['draft',`?onderdeel=verslagen&verslag=${note}&bewerken=1`],['read',`?onderdeel=verslagen&verslag=${finalNote}`],['details','?onderdeel=gegevens'],['access','?onderdeel=toegang'],['appointments','?onderdeel=afspraken']]){
      await go(query);await page.locator('.record-workspace').waitFor();
      if(['editor','draft'].includes(name))await page.locator('[data-editor-ready] .record-editor__document').waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow at ${width}`);
      if(width<=760 && ['editor','draft'].includes(name))assert.equal(await page.locator('.record-editor__document').evaluate(el=>getComputedStyle(el).fontSize),'16px');
      if(width===390||width===1024||(width===320&&['editor','draft'].includes(name)))await capture({path:new URL(`${name}-${width}.png`,output).pathname,fullPage:true});
    }
  }
  await page.setViewportSize({width:390,height:844});
  await go('?onderdeel=verslagen');
  assert.equal(await page.locator('.record-note-index').isVisible(),true);
  assert.equal(await page.locator('.record-note-detail').isVisible(),false);
  await page.locator('.record-note-item').first().click();
  assert.equal(await page.locator('.record-note-index').isVisible(),false);
  await page.getByRole('link',{name:'Concept bewerken'}).click();
  await page.locator('[data-editor-ready] .record-editor__document').waitFor();
  assert.equal(await page.locator('.client-note__body > .client-note__content').count(),0);
  await page.getByRole('link',{name:'Terug naar verslag'}).click();
  await page.locator('.client-note__body > .client-note__content').waitFor();
  await page.locator('.record-note-back').click();
  await page.locator('.record-note-index').waitFor({state:'visible'});
  await go('?onderdeel=toegang&readonly=1',true);
  assert.equal(await page.locator('.client-assignment-add').count(),0);
  assert.equal(await page.locator('.client-assignment-remove').count(),0);
  assert.equal(await page.locator('.record-management').count(),0);
  await capture({path:new URL('practice-mobile.png',output).pathname,fullPage:true});
  await go('?onderdeel=verslagen&archived=1');
  assert.equal(await page.locator('.record-new-note').count(),0);
  await go('?onderdeel=verslagen&empty=1');
  await page.getByRole('heading',{name:'Het eerste verslag begint hier'}).waitFor();
  await go('?onderdeel=toegang&long=1');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await capture({path:new URL('mobile.png',output).pathname,fullPage:true});
  await go(`?verslag=${note}&rich=1&geschiedenis=${note}`);
  assert.equal(await page.locator('.client-note__body > .record-formatted-note h4').textContent(),'Opvolging');
  assert.equal(await page.locator('.client-note__body > .record-formatted-note ul li').count(),2);
  await page.locator('.client-note-history summary').click();
  assert.equal(await page.locator('.client-note-history strong').textContent(),'Eerder vastgelegd');
  await capture({path:new URL('rich-read-mobile.png',output).pathname,fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await go(`?verslag=${note}&rich=1&bewerken=1`);
  await page.locator('[data-editor-ready]').waitFor();
  assert.equal(await page.locator('.record-editor__document h2').textContent(),'Opvolging');
  await capture({path:new URL('rich-editor-desktop.png',output).pathname,fullPage:true});
  const native=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await native.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  const nativePage=await native.newPage();await nativePage.goto(`${origin}/record-workspace-fixture/${id}?verslag=nieuw`);
  assert.equal(await nativePage.locator('textarea[name=body]').isVisible(),true);
  assert.equal(await nativePage.locator('[name=body_document]').isDisabled(),true);
  await native.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: rich formatting, shortcuts, toolbar focus, undo/redo, sanitized paste, empty/length validation, failed-save retention, formatted history, native fallback; four isolated sections, single-note reading/writing, direct links, browser history, legacy fragments, correction flow, filters, unsaved protection, failed save recovery, portraits/fallback, archive/read-only/practice and responsive layouts at 1440/1024/768/390/320px.');
  console.log(`Screenshots: ${output.pathname}`);
}finally{
  await browser?.close();server?.kill();
  for(const file of created)await unlink(file);
  for(const dir of fixtureDirs)try{await rmdir(dir);}catch{}
}
