import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const head = readFileSync(new URL('../src/components/astro/HomeLoadingHead.astro', import.meta.url), 'utf8');
const bootstrap = head.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
const scene = readFileSync(new URL('../src/scripts/homeExperience.js', import.meta.url), 'utf8');
const preparation = scene.slice(scene.indexOf(' const decodeImage='), scene.indexOf('\n document.fonts.ready.then', scene.indexOf(' const decodeImage=')));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function boot({ returning = false, reduced = false, storageFails = false } = {}) {
  const classes = new Set();
  const html = { dataset: {}, classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)) } };
  const events = new Map();
  const timers = new Map();
  let next = 0;
  const context = {
    document: { documentElement: html },
    matchMedia: () => ({ matches: reduced }),
    sessionStorage: {
      getItem: () => { if (storageFails) throw Error('unavailable'); return returning ? '1' : null; },
      setItem: () => { if (storageFails) throw Error('unavailable'); },
    },
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) },
    setTimeout: (fn, ms) => { timers.set(++next, { fn, ms }); return next; },
    clearTimeout: id => timers.delete(id),
  };
  vm.runInNewContext(bootstrap, context);
  return { html, classes, context, timers, fire: name => events.get(name)?.(), tick: ms => {
    for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); }
  } };
}

test('first paint is guarded synchronously, including returning visits', () => {
  for (const returning of [false, true]) {
    const b = boot({ returning });
    assert.equal(b.classes.has('home-booting'), true);
    assert.equal(b.html.dataset.homeOpening, 'pending');
    assert.equal(b.classes.has('home-booting-quiet'), returning);
  }
});

test('ready reveals the scene before the loading layer exits', () => {
  const b = boot();
  b.fire('home:ready');
  assert.equal(b.classes.has('home-booting'), false);
  assert.equal(b.classes.has('home-revealing'), true);
  assert.equal(b.html.dataset.homeOpening, 'ready');
  b.tick(480);
  assert.equal(b.classes.has('home-revealing'), false);
});

test('a failed boot reveals a stable fallback and ignores late readiness', () => {
  const b = boot();
  b.tick(4500);
  b.fire('home:ready');
  assert.equal(b.classes.has('home-booting'), false);
  assert.equal(b.html.dataset.homeOpening, 'fallback');
});

test('reduced motion and unavailable session storage still reveal content', () => {
  const b = boot({ reduced: true, storageFails: true });
  b.fire('home:ready');
  assert.equal(b.classes.has('home-booting'), false);
  assert.equal(b.classes.has('home-revealing'), false);
});

test('pagehide never stores an opaque loading layer in the back-forward cache', () => {
  const b = boot();
  b.fire('pagehide');
  assert.equal(b.classes.has('home-booting'), false);
  assert.equal(b.classes.has('home-revealing'), false);
});

function prepare(b, { pending = false } = {}) {
  let resolveImage;
  const image = { decode: () => pending ? new Promise(resolve => { resolveImage = resolve; }) : Promise.resolve() };
  const frames = [];
  const measurements = [];
  const context = {
    ...b.context,
    heroLandscape: { decode: () => Promise.resolve() },
    portalImage: image,
    heroBrand: { querySelector: () => ({ decode: () => Promise.resolve() }) },
    document: { ...b.context.document, fonts: { ready: Promise.resolve() } },
    location: { hash: '' },
    requestAnimationFrame: fn => frames.push(fn),
    Event,
    initialized: false,
    manualOff: false,
    measure: () => measurements.push(context.manualOff ? 'static' : 'portal'),
    go() {},
  };
  context.window = { ...context.window, dispatchEvent: event => b.fire(event.type) };
  const sandbox = vm.createContext(context);
  vm.runInContext(preparation, sandbox);
  return { frames, measurements, resolve: () => resolveImage(), sandbox };
}

test('no initial scene measurement until the portal is decoded; reveal waits for two frames', async () => {
  const b = boot();
  const p = prepare(b, { pending: true });
  await flush();
  assert.equal(p.measurements.length, 0);
  assert.equal(b.classes.has('home-booting'), true);
  p.resolve();
  await flush();
  assert.deepEqual(p.measurements, ['portal']);
  assert.equal(b.classes.has('home-booting'), true);
  p.frames.shift()();
  assert.equal(b.classes.has('home-booting'), true);
  p.frames.shift()();
  assert.equal(b.classes.has('home-booting'), false);
});

test('an asset deadline selects a static layout before the first measurement', async () => {
  const b = boot();
  const p = prepare(b, { pending: true });
  b.tick(3500);
  await flush();
  assert.deepEqual(p.measurements, ['static']);
  p.resolve();
  await flush();
  assert.equal(p.sandbox.manualOff, true);
});

test('a module that starts after the head deadline cannot enable the portal', async () => {
  const b = boot();
  b.tick(4500);
  const p = prepare(b);
  await flush();
  assert.deepEqual(p.measurements, ['static']);
});
