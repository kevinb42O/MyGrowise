import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const layout = readFileSync(new URL('../src/layouts/MainLayout.astro', import.meta.url), 'utf8');
const script = layout.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];

function renderSection({ height, visibleHeight, noMotion = false }) {
  const classes = new Set();
  const container = {
    dataset: {},
    style: { setProperty() {} },
    classList: { contains: name => classes.has(name), add: name => classes.add(name) },
    hasAttribute: name => name === 'data-no-motion' && noMotion,
    querySelector: () => null,
  };
  const section = { querySelector: () => container, querySelectorAll: () => [] };
  vm.runInNewContext(script, {
    window: { location: { pathname: '/privacy' }, matchMedia: () => ({ matches: false }) },
    document: {
      documentElement: { classList: { add() {} } },
      querySelectorAll: selector => selector === '#inhoud > section' ? [section] : [],
    },
    IntersectionObserver: class {
      constructor(callback, options) { this.callback = callback; this.threshold = options.threshold; }
      observe(target) {
        // Start below the viewport, then scroll a viewport-sized slice into
        // view. Its ratio stays below 12% for a long document container.
        this.callback([{ target, isIntersecting: false, intersectionRatio: 0 }]);
        if (visibleHeight / height > this.threshold) {
          this.callback([{ target, isIntersecting: true, intersectionRatio: visibleHeight / height }]);
        }
      }
      unobserve() {}
    },
  });
  return { container, classes };
}

test('long reading sections reveal on their first viewport intersection', () => {
  const { classes } = renderSection({ height: 12000, visibleHeight: 650 });
  assert.equal(classes.has('is-motion-visible'), true);
});

test('reading content marked without motion is never hidden by the reveal script', () => {
  const { container } = renderSection({ height: 12000, visibleHeight: 650, noMotion: true });
  assert.equal(container.dataset.siteMotion, undefined);
});
