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
