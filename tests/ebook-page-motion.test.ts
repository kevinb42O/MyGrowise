import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPageSpring } from '../src/lib/ebooks/reader/pageMotion.ts';

test('page turns have the same position and momentum at different frame rates', () => {
  function run(hz: number) {
    let state = {value:0, velocity:1.4};
    for (let i=0;i<hz;i++) state=stepPageSpring(state.value,state.velocity,1,1/hz);
    return state;
  }
  const a=run(60), b=run(120);
  assert.ok(Math.abs(a.value-b.value)<1e-12);
  assert.ok(Math.abs(a.velocity-b.velocity)<1e-12);
  assert.ok(a.value>.999);
});

test('page turns travel gently through the curl and settle without overshooting', () => {
  let state={value:0,velocity:1.4};
  for(let i=0;i<120;i++) {
    const next=stepPageSpring(state.value,state.velocity,1,1/120);
    assert.ok(next.value>=state.value && next.value<=1);
    state=next;
    if(i===23) assert.ok(state.value>.6 && state.value<.8);
    if(i===59) assert.ok(state.value>.97 && state.value<.995);
  }
});

test('reversing a turn preserves its presentation and settles back to the original page', () => {
  let state=stepPageSpring(0,1.4,1,.2);
  const first=stepPageSpring(state.value,state.velocity,0,1/120);
  assert.ok(Math.abs(first.value-state.value)<.03);
  for(let i=0;i<120;i++) state=stepPageSpring(state.value,state.velocity,0,1/120);
  assert.ok(Math.abs(state.value)<.001);
  assert.ok(Math.abs(state.velocity)<.01);
});
