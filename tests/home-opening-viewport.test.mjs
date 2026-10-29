import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const scene = readFileSync(new URL('../src/scripts/homeExperience.js', import.meta.url), 'utf8');
// Exercise the real viewport gates before the DOM fit checks. Browser tests
// separately verify that the resulting compact composition actually fits.
const gates = scene.slice(scene.indexOf(' function measure(){'), scene.indexOf('  // Always measure one clean candidate layout.'));
function eligibility({ width = 375, available, reduced = false, manualOff = false }) {
  const classes = new Set();
  return vm.runInNewContext(`${gates}\n return {heroEnabled, enabled, compact: root.classList.contains('compact-opening')}; } measure();`, {
    initialized: true, innerWidth: width, manualOff, reduced: { matches: reduced },
    enabled: false, heroEnabled: false,
    viewportMeasure: { clientHeight: available },
    document: { querySelector: () => ({ getBoundingClientRect: () => ({ height: 81 }) }) },
    root: {
      style: { setProperty() {} },
      classList: {
        toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name),
      },
    },
  });
}

test('compact portrait viewports retain the head intro without enabling later pinned scenes', () => {
  for (const available of [520, 539, 559, 583, 619, 643]) {
    const result = eligibility({ available });
    assert.equal(result.heroEnabled, true, `opening at ${available}px`);
    assert.equal(result.enabled, false, `later scenes at ${available}px`);
    assert.equal(result.compact, true);
  }
});

test('desktop eligibility and very short viewport fallback remain intact', () => {
  assert.equal(eligibility({ width: 1440, available: 599 }).heroEnabled, false);
  assert.equal(eligibility({ width: 1440, available: 600 }).heroEnabled, true);
  assert.equal(eligibility({ available: 519 }).heroEnabled, false);
  assert.equal(eligibility({ available: 650 }).enabled, true);
});

test('reduced motion and an explicit quiet-view choice still disable the intro', () => {
  assert.equal(eligibility({ available: 583, reduced: true }).heroEnabled, false);
  assert.equal(eligibility({ available: 583, manualOff: true }).heroEnabled, false);
});

test('phone title growth stays within the viewport at every zoom position', () => {
  const start = scene.indexOf('    const readingLimit=');
  const sizing = scene.slice(start, scene.indexOf('    const gap=', start));
  for (const stageWidth of [320, 375, 390, 430]) {
    const lines = [{ width: stageWidth * .65 }, { width: stageWidth * .9 }];
    const readingScale = Math.min(1, stageWidth * .82 / Math.max(...lines.map(line => line.width)));
    for (let step = 0; step <= 100; step++) {
      const readingSize = vm.runInNewContext(`${sizing}\n readingSize;`, {
        mobile: true, stageWidth, lines, readingScale, intro: step / 100,
        phase: (value, from, to) => Math.max(0, Math.min(1, (value - from) / (to - from))),
      });
      for (const line of lines) assert.ok(line.width * readingSize <= stageWidth * .88 + .001);
    }
  }
  const desktopSize = vm.runInNewContext(`${sizing}\n readingSize;`, {
    mobile: false, stageWidth: 1440, lines: [{ width: 500 }], readingScale: 1, intro: .7,
    phase: () => 1,
  });
  assert.equal(desktopSize, 1.65, 'desktop title growth is preserved');
});
