import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightedParts } from '../src/lib/clientSearchText.ts';
test('search highlighting handles accents, reordered words and repeated matches', () => {
  assert.deepEqual(highlightedParts('Zoë Paarden', 'paarden zoe'), [{ text:'Zoë', match:true },{ text:' ', match:false },{ text:'Paarden', match:true }]);
  assert.deepEqual(highlightedParts('Anna An', 'an').filter(x => x.match).map(x => x.text), ['An','An']);
});
test('highlighting preserves literal markup, punctuation and Unicode', () => {
  for (const text of ['<script>alert(1)</script>', '😀 Zoë', 'Zoe\u0308', '100% [naam]']) {
    assert.equal(highlightedParts(text, '[naam] 😀 zoe').map(x => x.text).join(''), text);
  }
  assert.deepEqual(highlightedParts('Zoë', ''), [{text:'Zoë',match:false}]);
});
