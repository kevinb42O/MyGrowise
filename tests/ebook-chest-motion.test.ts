import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chestPose,chestDuration} from '../src/lib/ebooks/reader/chestMotion.ts';

test('chest unlocks before lifting and stays open long enough to look inside',()=>{
  assert.equal(chestPose(0).open,0);
  assert.ok(chestPose(.15).unlock>.9);
  assert.equal(chestPose(.15).open,0);
  assert.ok(chestPose(.7).open>.5);
  for(const t of [1.2,2,3,3.9])assert.equal(chestPose(t).open,1);
});
test('chest returns exactly to its original artwork without a final pop',()=>{
  const end=chestPose(chestDuration);
  assert.deepEqual(end,{open:0,light:0,unlock:0});
  assert.ok(chestPose(5).open<.002);
});
test('chest movement and light remain bounded throughout the whole scene',()=>{
  for(let t=-1;t<8;t+=1/120){
    for(const value of Object.values(chestPose(t)))assert.ok(value>=0&&value<=1);
  }
  const step=1/120;
  for(const t of [.18,1.13,3.95,5.05]){
    assert.ok(Math.abs(chestPose(t+step).open-chestPose(t-step).open)<.001);
  }
});
