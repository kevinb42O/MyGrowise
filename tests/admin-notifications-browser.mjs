// Synthetic local rendering of the real layouts; all notification API requests are mocked.
// PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/admin-notifications-browser.mjs
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = new URL('../src/pages/notification-audit-fixture.astro', import.meta.url);
const origin = process.env.MYGROWISE_AUDIT_ORIGIN || 'http://127.0.0.1:4338';
const output = '/tmp/mygrowise-notification-browser';
let server, browser, ownsFixture = false;
try {
  await writeFile(fixture, `---
import AdminLayout from '../layouts/AdminLayout.astro';
import PracticeLayout from '../layouts/PracticeLayout.astro';
if (!import.meta.env.DEV) return new Response(null, { status: 404 });
const role = Astro.url.searchParams.get('role') || 'super_admin';
const practice = role === 'practitioner';
const user = {sub:'11111111-1111-4111-8111-111111111111',name:'Audit gebruiker',roles:[role],practitionerId: practice ? '22222222-2222-4222-8222-222222222222' : null};
Astro.locals.currentUser = user;
Astro.locals.adminUser = user;
const Layout = practice ? PracticeLayout : AdminLayout;
---
<Layout title="Dashboard"><div class="admin-page"><h1>Dashboard</h1><p>Lokale notificatiecontrole met synthetische gegevens.</p></div></Layout>
`, { flag: 'wx' });
  ownsFixture = true;
  if (!process.env.MYGROWISE_AUDIT_ORIGIN) server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', '4338'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  let errors = '';
  server?.stderr.on('data', data => { errors += data; });
  server?.stdout.on('data', data => { errors += data; });
  let lastResponse = '';
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await fetch(`${origin}/notification-audit-fixture`); if (response.ok) break; lastResponse = `${response.status}: ${(await response.text()).slice(0,500)}`; } catch {}
    if (attempt === 59) throw new Error(`Local server unavailable: ${errors} ${lastResponse}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  await mkdir(output, { recursive: true });
  let checks = 0;
  for (const role of ['super_admin', 'support', 'employee', 'practitioner']) {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      let unread = 41, requests = [], attentionFail = false, readFail = false, partial = false;
      const surface = role === 'practitioner' ? 'praktijk' : 'admin';
      const items = [
        { key: 'messages', href: `/${surface}/berichten?view=team`, label: 'Ongelezen teammeldingen', count: 2 },
        { key: 'bookings', href: `/${surface}/boekingen?status=pending`, label: 'Boekingsaanvragen', count: 3 },
      ];
      const createdAt = '2026-11-17T22:00:00Z';
      const id = '11111111-1111-4111-8111-111111111111';
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await page.route('**/api/**', async route => {
        const url = route.request().url();
        if (url.includes('/internal/attention')) {
          await route.fulfill({ status: attentionFail ? 503 : 200, json: { items: partial ? items.slice(0, 1) : items, unavailable: partial ? ['bookings'] : [], checkedAt: createdAt } });
        } else if (url.includes('/internal/notifications')) {
          if (route.request().method() === 'POST') {
            requests.push(route.request().postDataJSON());
            if (!readFail) unread = 1; // Simulate a new notification after the snapshot.
            await route.fulfill({ status: readFail ? 502 : 200, json: { ok: !readFail } });
          } else await route.fulfill({ json: { unreadCount: unread, checkedAt: '2026-11-18T08:00:00Z', notifications: Array.from({ length: Math.min(unread, 20) }, (_, index) => ({ id: `${id}-${index}`, threadId: id, supportConversationId: null, title: index === 0 ? '<img src=x onerror=alert(1)> Veilig teambericht' : 'Een bericht met een lang onderwerp dat correct moet afbreken in een kleine weergave', createdAt })) } });
        } else await route.fulfill({ json: { results: [] } });
      });
      await page.goto(`${origin}/notification-audit-fixture?role=${role}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('[data-notification-count]')?.textContent === '41');
      await page.waitForFunction(() => document.querySelector('[data-attention-heading]')?.textContent === 'Op te volgen' && !document.querySelector('[data-attention-keys="*"]')?.hidden);
      const messagesDot = page.locator(`.admin-nav a[href="/${surface}/berichten"] [data-attention-keys]`);
      assert.equal(await messagesDot.getAttribute('hidden'), null);
      if (width < 1000) {
        await page.locator('[data-sidebar-open]').click();
        await page.waitForFunction(() => Math.abs(document.querySelector('.admin-sidebar').getBoundingClientRect().x) < 1);
      }
      await page.screenshot({ path: `${output}/${role}-${width}-menu.png`, fullPage: true });
      if (width < 1000) {
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.admin-sidebar').getBoundingClientRect().right <= 1);
      }
      await page.locator('[data-notification-toggle]').click();
      const panel = page.locator('[data-notification-panel]');
      assert.ok(await panel.isVisible());
      assert.match(await panel.textContent(), /nieuwste 20 van 41/);
      assert.equal(await panel.locator('img').count(), 0, 'notification titles are text, never markup');
      assert.equal(await panel.locator('a').first().getAttribute('href'), `/${surface}/berichten?view=team&thread=${id}`);
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `panel fits ${width}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow: ${role} ${width}`);
      await page.screenshot({ path: `${output}/${role}-${width}-bell.png`, fullPage: true });
      await page.keyboard.press('Escape');
      assert.equal(await panel.isVisible(), false);
      assert.equal(await page.locator('[data-notification-toggle]').evaluate(node => node === document.activeElement), true);
      await page.locator('[data-notification-toggle]').click();
      await page.locator('.admin-topbar__left strong').click();
      assert.equal(await panel.isVisible(), false, 'outside click dismisses');
      await page.locator('[data-notification-toggle]').click();
      readFail = true;
      await page.locator('[data-notification-read-all]').click();
      await page.waitForFunction(() => document.querySelector('[data-notification-status]')?.textContent.includes('niet gelukt'));
      assert.equal(await page.locator('[data-notification-count]').textContent(), '41');
      readFail = false;
      await page.locator('[data-notification-read-all]').click();
      await page.waitForFunction(() => document.querySelector('[data-notification-count]')?.textContent === '1');
      assert.ok(requests.every(body => body.all === true && body.before === '2026-11-18T08:00:00Z'));
      await page.keyboard.press('Escape');
      partial = true;
      await page.evaluate(() => window.dispatchEvent(new Event('notifications:changed')));
      await page.waitForFunction(() => document.querySelector('[data-attention-heading]')?.textContent.includes('onvolledig'));
      if (role !== 'employee') assert.equal(await page.locator(`.admin-nav a[href="/${surface}/boekingen"] [data-attention-keys]`).getAttribute('hidden'), null, 'partial failures preserve known signals');
      attentionFail = true;
      await page.evaluate(() => window.dispatchEvent(new Event('notifications:changed')));
      await page.waitForFunction(() => document.querySelector('[data-attention-heading]')?.textContent.includes('niet bereikbaar'));
      assert.equal(await messagesDot.getAttribute('hidden'), null);
      assert.deepEqual(pageErrors, [], 'no runtime errors');
      checks++;
      await context.close();
    }
  }
  console.log(`PASS: ${checks} role/viewport scenarios, counters, safe titles, tab links, Escape/focus, outside click, failed read-all, new arrivals, partial/full outages, screenshots: ${output}`);
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
  if (ownsFixture) await unlink(fixture).catch(() => {});
}
