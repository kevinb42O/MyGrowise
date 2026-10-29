import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const scene = readFileSync(new URL('../src/scripts/homeExperience.js', import.meta.url), 'utf8');
const start = scene.indexOf('   const closing=phase(position,score.thoughts.end');
const closingFrame = scene.slice(start, scene.indexOf('   semantic(hero,exit', start));
function render(width, progress) {
  const lines = Array.from({ length: 3 }, () => ({ style: { setProperty() {} } }));
  const closing = {};
  vm.runInNewContext(closingFrame, {
    innerWidth: width, position: 3.95 + progress * .15,
    score: { thoughts: { end: 4.1 } }, thoughtPosition: 2, firstThought: 1,
    recognitionLines: lines, recognitionClosing: closing,
    phase: (value, from, to) => Math.max(0, Math.min(1, (value - from) / (to - from))),
    set: (element, values) => Object.assign(element, values),
    semantic: (element, active) => { element.active = active; },
  });
  return { thought: lines[2], closing };
}

test('mobile closing replaces the thought without painting both texts in one slot', () => {
  for (let step = 0; step <= 100; step++) {
    const { thought, closing } = render(375, step / 100);
    assert.ok(thought.opacity <= .0001 || closing.opacity <= .0001);
  }
  const final = render(375, 1);
  assert.equal(final.thought.active, false);
  assert.equal(final.closing.active, true);
});

test('desktop keeps its existing thought opacity while the closing appears below it', () => {
  for (const progress of [0, .25, .5, .75, 1]) {
    const { thought, closing } = render(1440, progress);
    assert.equal(thought.opacity, 1);
    assert.ok(Math.abs(closing.opacity - progress) < .0001);
  }
});
