import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const scene = readFileSync(new URL('../src/scripts/homeExperience.js', import.meta.url), 'utf8');
const start = scene.indexOf('   // One composition:');
const recognitionFrame = scene.slice(start, scene.indexOf('   semantic(hero,true)', start));

test('all recognition sentences and the next step remain readable together', () => {
  const lines = Array.from({ length: 3 }, () => ({}));
  const closing = {}, title = {};
  vm.runInNewContext(recognitionFrame, {
    recognitionTitle: title, recognitionLines: lines, recognitionClosing: closing,
    set: (element, values) => Object.assign(element, values),
    semantic: (element, active) => { element.active = active; },
  });
  for (const element of [...lines, closing]) {
    assert.equal(element.opacity, 1);
    assert.equal(element.active, true);
    assert.equal(element.transform, 'none');
  }
});

test('native recognition has no scroll holds or blank handoff before insight', () => {
  const scoreStart = scene.indexOf(' function composeScore()');
  const scoreEnd = scene.indexOf(' const progress=', scoreStart);
  const score = vm.runInNewContext(
    scene.slice(scoreStart, scoreEnd) + ';composeScore()',
    { portalEnabled: true, modulePapers: Array(3) },
  );
  assert.equal(score.openingEnd, score.intro.end);
  assert.equal(score.insightRead.start, score.openingEnd);
  assert.equal(score.material, undefined);
  assert.equal(score.recognitionRead, undefined);
  assert.equal(score.recognitionEnter, undefined);
  assert.equal(score.handoff, undefined);
});
