// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/platform-updates-browser.mjs
// Creates a temporary DEV-only fixture and removes it on completion. Start Astro locally first.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.UPDATES_TEST_ORIGIN || 'http://localhost:4321';
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/platform-updates.json', import.meta.url), 'utf8'),
);
const fixturePath = new URL('../src/pages/updates-browser-fixture.astro', import.meta.url);
writeFileSync(
  fixturePath,
  readFileSync(new URL('./fixtures/platform-updates-page.txt', import.meta.url)),
  { flag: 'wx' },
);
let comments = [],
  posts = [],
  failLoad = false,
  failPost = false;
const uid = '11111111-1111-4111-8111-111111111111';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
const page = await context.newPage();
let errors = [];
page.on('pageerror', (e) => errors.push(e.message));
mkdirSync('output/updates', { recursive: true });
try {
  await context.route('**/api/admin/updates?*', async (route) => {
    if (failLoad) {
      await route.fulfill({
        status: 503,
        json: { error: 'De updates konden niet worden geladen.' },
      });
      return;
    }
    const url = new URL(route.request().url());
    const slug = url.searchParams.get('slug');
    if (slug) {
      const item = fixture.items.find((x) => x.slug === slug);
      await route.fulfill({
        json: {
          item,
          events: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              position: 1,
              title: 'Het idee krijgt vorm',
              body: 'We brengen alle verbeteringen samen op één rustige plek. Je volgt de voortgang en geeft feedback bij het juiste onderwerp.',
              status: 'planned',
              created_at: item.created_at,
            },
            {
              id: '77777777-7777-4777-8777-777777777777',
              position: 2,
              title: 'De werkruimte wordt gebouwd',
              body: 'De leeslijst, tijdlijn en feedback worden uitgewerkt. Daarna controleren we hoe alles werkt op computer en telefoon.',
              status: 'in_progress',
              created_at: item.created_at,
            },
          ],
          comments,
          eventCount: 2,
          commentCount: comments.length,
        },
      });
      return;
    }
    let items = fixture.items.filter(
      (i) => url.searchParams.get('filter') !== 'released' || i.status === 'released',
    );
    if (['website', 'dashboard'].includes(url.searchParams.get('audience')))
      items = items.filter((i) => i.audience === url.searchParams.get('audience'));
    if (url.searchParams.get('q'))
      items = items.filter((x) =>
        x.title.toLowerCase().includes(url.searchParams.get('q').toLowerCase()),
      );
    if (url.searchParams.get('unread') === '1') items = items.filter((i) => i.unread);
    await route.fulfill({ json: { items, total: items.length, page: 1 } });
  });
  await context.route('**/api/admin/updates', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const payload = route.request().postDataJSON();
    posts.push(payload);
    if (failPost) {
      await route.fulfill({
        status: 503,
        json: { error: 'Opslaan is niet gelukt. Je tekst blijft staan; probeer opnieuw.' },
      });
      return;
    }
    if (payload.action === 'comment')
      comments.push({
        id: payload.data.token,
        author_id: uid,
        author_name: 'Virginie',
        body: payload.data.body,
        created_at: '2026-11-18T13:00:00Z',
        feedback_status: 'received',
        reply_to: null,
      });
    await route.fulfill({
      json: {
        id: fixture.items[0].id,
        notification: payload.action === 'comment' ? 'sent' : undefined,
      },
    });
  });
  const go = async (suffix = '') => {
    await page.goto(`${base}/updates-browser-fixture${suffix}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.locator('.up-loading').waitFor({ state: 'detached' });
  };
  await go();
  await page.locator('.up-row').first().waitFor();
  assert.equal(await page.locator('.up-row').count(), 10);
  await page.screenshot({ path: 'output/updates/overview-desktop.png', fullPage: true });
  await page.screenshot({ path: 'output/updates/preview.png' });
  await page
    .getByRole('group', { name: 'Omgeving' })
    .getByRole('button', { name: 'Website', exact: true })
    .click();
  await page.waitForFunction(() => document.querySelectorAll('.up-row').length === 5);
  await page
    .getByRole('group', { name: 'Omgeving' })
    .getByRole('button', { name: 'Dashboard', exact: true })
    .click();
  await page.waitForFunction(() => document.querySelectorAll('.up-row').length === 5);
  await page
    .getByRole('group', { name: 'Omgeving' })
    .getByRole('button', { name: 'Alles', exact: true })
    .click();
  await page.getByRole('button', { name: 'Beschikbaar', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.up-row').length === 1);
  await page
    .getByRole('navigation', { name: 'Updates filteren' })
    .getByRole('button', { name: 'Alles', exact: true })
    .click();
  await page.getByRole('searchbox').fill('zzzz');
  await page.getByRole('heading', { name: 'Geen updates gevonden.' }).waitFor();
  await page.getByRole('button', { name: 'Filters wissen' }).click();
  await page.locator('.up-row').first().waitFor();
  await page.getByRole('button', { name: /Nieuwe update/ }).click();
  assert.ok(await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: /Nieuwe update/ }).click();
  await page.getByRole('dialog').getByLabel('Titel', { exact: true }).fill('Nieuw onderwerp');
  await page.keyboard.press('Escape');
  await page.getByText('Je wijzigingen zijn nog niet opgeslagen.').waitFor();
  await page.getByRole('button', { name: 'Verder schrijven' }).click();
  assert.equal(
    await page.getByRole('dialog').getByLabel('Titel', { exact: true }).inputValue(),
    'Nieuw onderwerp',
  );
  await page.getByRole('button', { name: 'Sluiten', exact: true }).click();
  await page.getByRole('button', { name: 'Wijzigingen verwerpen' }).click();
  const suffix = '?slug=' + fixture.items[0].slug;
  await go(suffix);
  await page.getByLabel('Jouw vraag of opmerking').waitFor();
  await page.screenshot({ path: 'output/updates/detail-desktop.png', fullPage: true });
  failPost = true;
  await page.getByLabel('Jouw vraag of opmerking').fill('Kan ik dit ook op mijn telefoon volgen?');
  await page.getByRole('button', { name: 'Feedback versturen' }).click();
  await page.getByRole('alert').filter({ hasText: 'Opslaan is niet gelukt' }).waitFor();
  assert.equal(
    await page.getByLabel('Jouw vraag of opmerking').inputValue(),
    'Kan ik dit ook op mijn telefoon volgen?',
  );
  failPost = false;
  await page.getByRole('button', { name: 'Feedback versturen' }).click();
  await page.getByText(/Je reactie is opgeslagen/).waitFor();
  assert.equal(comments.length, 1);
  assert.equal(await page.getByLabel('Jouw vraag of opmerking').inputValue(), '');
  assert.ok(posts.some((p) => p.action === 'read'));
  comments.push({
    id: '88888888-8888-4888-8888-888888888888',
    author_id: '22222222-2222-4222-8222-222222222222',
    author_name: 'Kevin',
    body: 'Welke stap hielp je het meest?',
    created_at: '2026-11-18T14:00:00Z',
    feedback_status: 'received',
    reply_to: null,
  });
  await go(suffix);
  await page.getByRole('button', { name: 'Antwoorden', exact: true }).click();
  await page.getByLabel('Antwoord aan Kevin').fill('De tijdlijn maakt het duidelijk.');
  await page
    .getByLabel('Verwerkt in een mijlpaal (optioneel)')
    .selectOption('77777777-7777-4777-8777-777777777777');
  await page.getByRole('button', { name: 'Antwoord plaatsen', exact: true }).click();
  await page.getByText('De tijdlijn maakt het duidelijk.', { exact: true }).waitFor();
  assert.equal(
    posts.filter((p) => p.action === 'comment').at(-1).data.event_id,
    '77777777-7777-4777-8777-777777777777',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-sidebar-open]').getAttribute('aria-expanded'), 'false');
  await page.screenshot({ path: 'output/updates/detail-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await go();
  await page.locator('.up-row').first().waitFor();
  await page.screenshot({ path: 'output/updates/overview-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  failLoad = true;
  await go();
  await page.getByRole('heading', { name: 'We konden de updates niet ophalen.' }).waitFor();
  failLoad = false;
  await page.getByRole('button', { name: 'Opnieuw proberen', exact: true }).click();
  await page.locator('.up-row').first().waitFor();
  for (const [name, width] of [
    ['desktop', 720],
    ['mobile', 390],
  ]) {
    const emailPage = await browser.newPage({ viewport: { width, height: 1000 } });
    await emailPage.route('**/images/logo-lelie.png', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: readFileSync('public/images/logo-lelie.png'),
      }),
    );
    await emailPage.setContent(readFileSync('output/updates/feedback-email.html', 'utf8'), {
      waitUntil: 'domcontentloaded',
    });
    await emailPage.waitForTimeout(300);
    await emailPage.screenshot({
      path: `output/updates/feedback-email-${name}.png`,
      fullPage: true,
    });
    assert.ok(await emailPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await emailPage.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS real workspace: overview, filters, search, empty state, editor focus/Escape, detail, read acknowledgment, failed feedback retention, retry, successful feedback, mobile overflow and load recovery.',
  );
} finally {
  await browser.close();
  unlinkSync(fixturePath);
}
