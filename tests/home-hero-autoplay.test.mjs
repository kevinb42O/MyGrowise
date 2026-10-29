import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/scripts/homeExperience.js', import.meta.url), 'utf8');
const autoplay = source.slice(source.indexOf(' // Only the portal intro'), source.indexOf(' function frameRecognition'));
function setup(scrollY = 0) {
  const events = new Map(), frames = new Map(), timers = new Map();
  let id = 0;
  class Element { closest() { return null; } }
  const state = {
    scrollY, initialized: true, portalEnabled: true, manualOff: false, reduced: { matches: false },
    stageSize: 1000, score: { intro: { end: 1.2 }, recognitionEnter: { start: 1.85, end: 2.2 } },
    journeyOrigin: () => 0, now: 0, performance: { now: () => state.now },
    clamp: x => Math.max(0, Math.min(1, x)), ease: x => x*x*(3-2*x), Element,
    document: { hidden: false, documentElement: { classList: { contains: () => false } }, addEventListener: (name, fn) => events.set(name, fn) },
    window: { addEventListener: (name, fn) => events.set(name, fn) },
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key),
    setTimeout: (fn, ms) => { timers.set(++id, { fn, at: state.now + ms }); return id; }, clearTimeout: key => timers.delete(key),
    scrollTo: ({top}) => { state.scrollY = top; }, update() {}, schedule() {},
  };
  vm.runInNewContext(autoplay, state);
  return {
    state, frames, timers,
    fire(name, data = {}) {
      const event = { target: new Element(), preventDefault() { this.blocked = true; }, ...data };
      events.get(name)?.(event); return event;
    },
    tick(now, paint = true) {
      state.now = now;
      for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.fn(); }
      if (paint) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); }
    },
  };
}

test('continuous scrolling cannot extend the intro deadline or block the screenshot landing', () => {
  const p = setup();
  assert.equal(p.fire('wheel', {deltaY:.01}).blocked, true);
  for (let time = 10; time < 4000; time += 10) {
    p.tick(time);
    assert.equal(p.fire('wheel', {deltaY:1}).blocked, true);
    assert.equal([...p.timers.values()][0].at, 4000);
  }
  p.tick(4000);
  assert.equal(p.state.scrollY, 1200);
  for (let i = 0; i < 500; i++) assert.equal(p.fire('wheel', {deltaY:1}).blocked, undefined);
  assert.equal(p.timers.size, 0);
});

test('the independent deadline releases scrolling even without animation frames', () => {
  const p = setup(0);
  p.fire('wheel', {deltaY:1});
  p.tick(4000, false);
  assert.equal(p.state.scrollY, 1200);
  assert.equal(p.fire('wheel', {deltaY:1}).blocked, undefined);
  assert.equal(p.frames.size, 0);
});

test('only the portal intro animates in reverse from the screenshot landing', () => {
  const p = setup(1200);
  assert.equal(p.fire('wheel', {deltaY:-.01}).blocked, true);
  p.tick(4000);
  assert.equal(p.state.scrollY, 0);
  assert.equal(p.fire('wheel', {deltaY:-1}).blocked, undefined);
});

test('scrolling down from the screenshot landing is entirely manual', () => {
  const p = setup(1200);
  assert.equal(p.fire('wheel', {deltaY:.01}).blocked, undefined);
  assert.equal(p.fire('keydown', {key:'ArrowDown'}).blocked, undefined);
  p.fire('touchstart', {touches:[{clientY:400}]});
  assert.equal(p.fire('touchmove', {touches:[{clientY:399.99}]}).blocked, undefined);
  assert.equal(p.frames.size, 0);
  assert.equal(p.timers.size, 0);
});

test('recognition content and all later sections always accept scrolling in both directions', () => {
  for (const y of [1202, 1500, 1850, 2200, 2202, 2500, 3500, 4800, 5100, 5700, 9000, 15000]) {
    const p = setup(y);
    for (const direction of [-1, 1]) {
      assert.equal(p.fire('wheel', {deltaY:direction}).blocked, undefined);
      assert.equal(p.fire('keydown', {key:direction > 0 ? 'ArrowDown' : 'ArrowUp'}).blocked, undefined);
      p.fire('touchstart', {touches:[{clientY:400}]});
      assert.equal(p.fire('touchmove', {touches:[{clientY:400-direction}]}).blocked, undefined);
    }
    assert.equal(p.timers.size, 0);
  }
});

test('escape, hiding the page, and reduced motion cannot leave a scroll lock', () => {
  for (const name of ['keydown', 'visibilitychange', 'pagehide']) {
    const p = setup();
    p.fire('wheel', {deltaY:1});
    p.state.document.hidden = true;
    p.fire(name, {key:'Escape'});
    assert.equal(p.timers.size, 0);
    assert.equal(p.frames.size, 0);
  }
  const p = setup();
  p.state.reduced.matches = true;
  assert.equal(p.fire('wheel', {deltaY:1}).blocked, undefined);
});
