// Start `npm run dev` first. No database writes; photo API responses are mocked.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/headshots-browser.mjs
import { writeFile, unlink, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.MYGROWISE_AUDIT_ORIGIN || 'http://localhost:4321';
const fixture = new URL('../src/pages/headshot-browser-fixture.astro', import.meta.url);
const output = '/tmp/mygrowise-headshots-browser';
let browser, ownsFixture = false;
try {
  await writeFile(fixture, `---
import AdminLayout from '../layouts/AdminLayout.astro';
import PracticeLayout from '../layouts/PracticeLayout.astro';
import HeadshotSettings from '../components/admin/HeadshotSettings.astro';
import HeadshotField from '../components/admin/HeadshotField.astro';
if (!import.meta.env.DEV) return new Response(null, {status:404});
const practice = Astro.url.searchParams.has('practice');
const create = Astro.url.searchParams.has('create');
const user = {sub:'11111111-1111-4111-8111-111111111111',name:'Virginie',email:'test@example.test',roles:[practice ? 'practitioner' : 'employee'],practitionerId:null,emailConfirmed:true,issuedAt:0,expiresAt:0,headshotPath:Astro.url.searchParams.has('uploaded')?'11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp':null};
Astro.locals.currentUser = user; Astro.locals.adminUser = user;
const Layout = practice ? PracticeLayout : AdminLayout;
---
<Layout title="Mijn account"><div class="admin-page admin-page--form"><h1>Mijn account</h1>{create ? <section class="admin-panel"><form action="/api/admin/users" method="post" enctype="multipart/form-data"><label>Naam<input name="full_name" value="Nieuwe medewerker" /></label><HeadshotField id="new-user-headshot" optional/><button type="submit">Account aanmaken</button></form></section> : <HeadshotSettings user={user} returnTo="/admin/account"/>}</div></Layout>
`, { flag: 'wx' });
  ownsFixture = true;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const photo = await readFile(new URL('../public/images/practitioners/virginie-real.jpg', import.meta.url));
  const sent = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    if (request.url().includes('/api/profile/headshot') && request.method() === 'GET') return route.fulfill({ contentType: 'image/jpeg', body: photo });
    if (request.method() === 'POST' && /\/(headshot|users)$/.test(new URL(request.url()).pathname)) {
      sent.push({ type: request.headers()['content-type'], body: request.postDataBuffer().toString('latin1') });
      const removed = sent.at(-1).body.includes('\r\nremove\r\n');
      return route.fulfill({ status: 303, headers: { location: `${origin}/headshot-browser-fixture?headshot=${removed ? 'removed' : 'saved'}${removed ? '' : '&uploaded=1'}#headshot` } });
    }
    return route.fulfill({ json: { items: [], notifications: [], unreadCount: 0, results: [] } });
  });
  await page.goto(`${origin}/headshot-browser-fixture`);
  await page.locator('[data-headshot-input]').waitFor();
  assert.equal(await page.locator('.admin-nav a[href="/admin/account"]').count(), 1);
  assert.equal(await page.locator('.admin-nav a[href="/admin/instellingen"]').count(), 0);
  for (const state of ['expanded', 'collapsed']) {
    await page.evaluate(state => document.documentElement.dataset.navigationState = state, state);
    const box = await page.locator('.admin-user__avatar').boundingBox();
    assert.equal(box.width, 30); assert.equal(box.height, 30);
  }
  const input = page.locator('[data-headshot-input]');
  await input.setInputFiles({ name: 'invalid.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('bad image') });
  await page.locator('[data-headshot-error]:not([hidden])').waitFor();
  assert.equal(await input.evaluate(el => el.checkValidity()), false);
  await input.setInputFiles({ name: 'oversized.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(3 * 1024 * 1024 + 1) });
  assert.match(await page.locator('[data-headshot-error]').textContent(), /3 MB/);
  await input.setInputFiles({ name: 'portrait.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.waitForFunction(() => document.querySelector('[data-headshot-preview]').src.startsWith('blob:'));
  assert.equal(await input.evaluate(el => el.checkValidity()), true);
  await page.getByRole('button', { name: 'Foto opslaan', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Je profielfoto is opgeslagen.' }).waitFor();
  assert.match(sent.at(-1).type, /multipart\/form-data/); assert.match(sent.at(-1).body, /filename="portrait.jpg"/);
  assert.match(await page.locator('.admin-user__avatar img').getAttribute('src'), /\/api\/profile\/headshot/);
  await mkdir(output, { recursive: true });
  await page.evaluate(() => document.documentElement.dataset.navigationState = 'expanded');
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.getByRole('button', { name: 'Eigen foto verwijderen' }).click();
  await page.getByRole('status').filter({ hasText: 'Je eigen foto is verwijderd.' }).waitFor();
  assert.match(await page.locator('.admin-user__avatar img').getAttribute('src'), /virginie-real/);
  await page.goto(`${origin}/headshot-browser-fixture?create=1`);
  await page.locator('[data-headshot-input]').setInputFiles({ name: 'new-headshot.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.getByRole('button', { name: 'Account aanmaken' }).click();
  await page.waitForURL('**/headshot-browser-fixture?headshot=saved&uploaded=1#headshot');
  assert.match(sent.at(-1).body, /filename="new-headshot.jpg"/);
  await page.goto(`${origin}/headshot-browser-fixture?practice=1&uploaded=1`);
  assert.match(await page.locator('.admin-user__avatar img').getAttribute('src'), /\/api\/profile\/headshot/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/headshot-browser-fixture?uploaded=1`);
  await page.locator('[data-headshot-input]').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/mobile.png` });
  assert.deepEqual(errors, []);
  console.log(`PASS: preview, invalid files, multipart save/create, removal, staff access, practice avatar and mobile layout. Screenshots: ${output}`);
} finally {
  await browser?.close();
  if (ownsFixture) await unlink(fixture);
}
