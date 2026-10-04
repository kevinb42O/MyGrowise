import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculatePrice,defaultPricing,safeExternalUrl} from '../src/lib/catalog/pricing.ts';
const items=(prices:number[])=>prices.map((priceCents,i)=>({id:String(i),priceCents}));
test('confirmed discount tiers and fixed package prices',()=>{
 for(const [prices,total,pct] of [[[4900],4900,0],[[5900,6900],12160,5],[[9900,5900,5900],20615,5],[[6900,6900,6900,6900],24840,10],[[4900,5900,5900,6900,9900],30150,10]] as [number[],number,number][]){const q=calculatePrice(items(prices),'custom');assert.equal(q.totalCents,total);assert.equal(q.discountPercent,pct);}
 assert.equal(calculatePrice(items([27500]),'package').totalCents,27500);
});
test('round final amount once, allocate every cent deterministically',()=>{const q=calculatePrice(items([3005,3005]),'custom');assert.equal(q.totalCents,5710);assert.equal(q.lines.reduce((s,x)=>s+x.payableCents,0),5710);assert.equal(q.discountCents,300);for(let count=1;count<=22;count++){const p=calculatePrice(items(Array.from({length:count},(_,i)=>101+i*7)),'custom');assert.equal(p.lines.reduce((s,x)=>s+x.payableCents,0),p.totalCents);}});
test('duplicates, empty and mixed fixed package orders cannot increase a discount',()=>{assert.throws(()=>calculatePrice([],'custom'));assert.throws(()=>calculatePrice([{id:'a',priceCents:4900},{id:'a',priceCents:4900}],'custom'));assert.throws(()=>calculatePrice(items([9900,6900]),'package'));assert.throws(()=>calculatePrice(items([-1]),'custom'));});
test('discount settings are configurable',()=>{assert.equal(calculatePrice(items([1000,1000,1000]),'custom',{...defaultPricing,mediumMin:3,mediumPercent:7,largeMin:5,largePercent:12}).totalCents,2790);});
test('assessment links allow only HTTPS without embedded credentials',()=>{assert.equal(safeExternalUrl('javascript:alert(1)'),null);assert.equal(safeExternalUrl('http://example.com'),null);assert.equal(safeExternalUrl('https://user:pass@example.com'),null);assert.equal(safeExternalUrl('https://example.com/start'),'https://example.com/start');});
