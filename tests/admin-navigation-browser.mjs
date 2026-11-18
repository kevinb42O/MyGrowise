// Real layouts + agenda island, synthetic user and mocked APIs; no database writes.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/admin-navigation-browser.mjs
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = new URL('../src/pages/navigation-browser-fixture.astro', import.meta.url);
const origin = process.env.MYGROWISE_AUDIT_ORIGIN || 'http://127.0.0.1:4341';
const output = '/tmp/mygrowise-navigation-browser';
let server, browser, ownsFixture = false;
try {
  await writeFile(fixture, `---
import AdminLayout from '../layouts/AdminLayout.astro';
import PracticeLayout from '../layouts/PracticeLayout.astro';
import UnifiedAgenda from '../components/admin/UnifiedAgenda';
if (!import.meta.env.DEV) return new Response(null, {status:404});
const practice = Astro.url.searchParams.has('practice');
const agenda = Astro.url.searchParams.has('agenda');
const user = {sub:'11111111-1111-4111-8111-111111111111',name:'Navigatiecontrole',roles:[practice ? 'practitioner' : 'super_admin'],practitionerId:null};
Astro.locals.currentUser = user;
Astro.locals.adminUser = user;
const Layout = practice ? PracticeLayout : AdminLayout;
---
<Layout title={agenda ? 'Agenda' : 'Dashboard'} agendaWorkspace={agenda}>
  {agenda ? <div class="admin-page agenda-page"><UnifiedAgenda mode={practice ? 'practice' : 'admin'} client:only="react" /></div> : <div class="admin-page"><h1>Dashboard</h1><p>Lokale controle met synthetische gegevens.</p><button id="content-control">Inhoud</button></div>}
</Layout>
`, { flag: 'wx' });
  ownsFixture = true;
  if (!process.env.MYGROWISE_AUDIT_ORIGIN) server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', '4341'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  let logs = '';
  server?.stdout.on('data', data => { logs += data; });
  server?.stderr.on('data', data => { logs += data; });
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(`${origin}/navigation-browser-fixture`)).ok) break; } catch {}
    if (attempt === 89) throw new Error(`Local server unavailable: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless:true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  await mkdir(output, {recursive:true});
  const context = await browser.newContext({viewport:{width:1440, height:1000}});
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({contentType:'text/css', body:''}));
  await context.route('**/api/**', route => route.fulfill({json:{items:[], unavailable:[], notifications:[], unreadCount:0, results:[], events:[], practitioners:[]}}));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const go = async (query = '') => {
    await page.goto(`${origin}/navigation-browser-fixture${query}`);
    if (!query.includes('practice') || query.includes('agenda')) await page.locator('.admin-nav-tooltip').waitFor({state:'attached'});
    if (query.includes('agenda')) await page.locator('[data-agenda-navigation]').waitFor();
  };
  const toggle = () => page.locator('[data-sidebar-open], [data-agenda-navigation]');
  const width = async () => Math.round((await page.locator('.admin-sidebar').boundingBox()).width);
  const state = () => page.locator('html').getAttribute('data-navigation-state');
  await go();
  assert.equal(await width(),248);
  assert.equal(await toggle().getAttribute('aria-expanded'),'true');
  await toggle().click();
  assert.equal(await width(),64);
  assert.equal(await page.locator('.admin-workspace').evaluate(el => getComputedStyle(el).marginLeft),'64px');
  assert.equal(await page.evaluate(() => localStorage.getItem('mygrowise.admin.navigation')),'collapsed');
  await page.reload();
  await page.locator('.admin-nav-tooltip').waitFor({state:'attached'});
  assert.equal(await width(),64);

  const link = page.locator('.admin-nav a[href="/admin/boekingen"]');
  await link.hover();
  const tooltip = page.locator('.admin-nav-tooltip');
  await tooltip.waitFor({state:'visible'});
  assert.equal(await tooltip.locator('strong').textContent(),'Boekingen');
  assert.equal(await tooltip.locator('.admin-nav-tooltip__context').textContent(),'Begeleiding');
  assert.equal(await link.getAttribute('title'),null);
  assert.match(await link.getAttribute('aria-describedby'),/admin-navigation-description/);
  const tipBox = await tooltip.boundingBox(), rail = await page.locator('.admin-sidebar').boundingBox();
  assert.ok(tipBox.x > rail.x + rail.width && tipBox.x + tipBox.width < 1440);
  await page.screenshot({path:`${output}/desktop-tooltip.png`});
  await tooltip.hover();
  await page.waitForTimeout(200);
  assert.ok(await tooltip.isVisible(),'hoverable tooltip');
  await page.keyboard.press('Escape');
  assert.ok(await tooltip.isHidden());
  assert.equal(await link.getAttribute('aria-describedby'),null);
  await link.evaluate(el => {
    el.setAttribute('aria-current','page');
    el.querySelector('.admin-attention-dot').hidden = false;
  });
  await page.mouse.move(500,400);
  await link.hover();
  await tooltip.waitFor({state:'visible'});
  assert.equal(await tooltip.locator('.admin-nav-tooltip__status').textContent(),'Huidige pagina · Aandacht nodig');
  await page.mouse.move(500,400);
  await link.focus();
  await page.keyboard.press('Tab');
  await tooltip.waitFor({state:'visible'});
  assert.equal(await tooltip.locator('strong').textContent(),'Cliëntendossiers');
  await page.keyboard.press('Escape');

  await go('?agenda');
  assert.equal(await width(),64);
  assert.equal(await toggle().getAttribute('aria-expanded'),'false');
  const search = page.locator('.agenda-client-search > summary');
  await search.focus();
  await tooltip.waitFor({state:'visible'});
  await page.keyboard.press('Enter');
  assert.ok(await tooltip.isHidden(),'keyboard activation dismisses the tooltip');
  assert.ok(await page.locator('.agenda-client-search').evaluate(el => el.open));
  await page.keyboard.press('Escape');
  await toggle().click();
  assert.equal(await width(),248);
  await page.waitForTimeout(250);
  const calendarWide = (await page.locator('.agenda-calendar').boundingBox()).width;
  await toggle().click();
  await page.waitForTimeout(250);
  assert.ok((await page.locator('.agenda-calendar').boundingBox()).width > calendarWide + 150);
  await toggle().click();
  await go();
  assert.equal(await width(),248,'agenda shares the explicit desktop preference');

  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(() => document.documentElement.dataset.navigationState === 'collapsed');
  assert.equal(await state(),'collapsed');
  assert.ok(await page.locator('.admin-sidebar').evaluate(el => el.inert));
  await toggle().click();
  assert.equal(await state(),'expanded');
  assert.ok(await page.locator('.admin-workspace').evaluate(el => el.inert));
  const first = page.locator('.admin-brand > a');
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),'Afmelden');
  await page.keyboard.press('Tab');
  assert.ok(await first.evaluate(el => el === document.activeElement));
  await page.waitForFunction(() => Math.abs(document.querySelector('.admin-sidebar').getBoundingClientRect().x) < 0.5);
  await page.screenshot({path:`${output}/mobile-open.png`});
  await page.keyboard.press('Escape');
  assert.ok(await toggle().evaluate(el => el === document.activeElement));
  assert.equal(await page.evaluate(() => localStorage.getItem('mygrowise.admin.navigation')),'expanded','mobile leaves desktop preference intact');
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForFunction(() => document.documentElement.dataset.navigationState === 'expanded');
  assert.equal(await width(),248);
  await toggle().click();
  // Cross-tab changes update the active shell without a reload.
  const other = await context.newPage();
  await other.goto(`${origin}/navigation-browser-fixture`);
  await other.evaluate(() => localStorage.setItem('mygrowise.admin.navigation','expanded'));
  await page.waitForFunction(() => document.documentElement.dataset.navigationState === 'expanded');
  await other.close();

  await page.evaluate(() => localStorage.removeItem('mygrowise.admin.navigation'));
  await go('?agenda');
  assert.equal(await width(),64,'fresh agenda defaults to compact');
  await go('?practice&agenda');
  assert.equal(await width(),64);
  await toggle().click();
  assert.equal(await width(),248);
  assert.equal(await page.evaluate(() => localStorage.getItem('mygrowise.admin.navigation')),null,'practice does not write the admin preference');
  await page.setViewportSize({width:320,height:740});
  await page.waitForFunction(() => document.documentElement.dataset.navigationState === 'collapsed');
  await toggle().click();
  assert.equal(await state(),'expanded');
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:1000});
  await go('?practice');
  assert.equal(await width(),248,'regular practice navigation is unchanged');

  // Optional storage must never prevent navigation from working.
  const blocked = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
  await blocked.route('**/api/**', route => route.fulfill({json:{items:[],notifications:[],unreadCount:0,results:[]}}));
  await blocked.route('https://fonts.googleapis.com/**', route => route.fulfill({contentType:'text/css', body:''}));
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked','SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked','SecurityError'); };
  });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(`${origin}/navigation-browser-fixture`);
  await blockedPage.locator('[data-sidebar-open]').click();
  assert.equal(await blockedPage.locator('html').getAttribute('data-navigation-state'),'collapsed');
  await blockedPage.locator('.admin-nav a[href="/admin/boekingen"]').hover();
  await blockedPage.locator('.admin-nav-tooltip').waitFor({state:'visible'});
  assert.equal(await blockedPage.locator('.admin-nav-tooltip').evaluate(el => getComputedStyle(el).animationName),'none');
  await blocked.close();
  assert.deepEqual(errors,[],'no browser errors');
  console.log(`PASS: desktop persistence, agenda resizing/hydration, hover + keyboard tooltips, focus trap, 320/390px mobile, breakpoints, cross-tab sync, practice isolation, blocked storage, reduced motion. Screenshots: ${output}`);
} finally {
  await browser?.close();
  server?.kill();
  if (ownsFixture) await unlink(fixture);
}
