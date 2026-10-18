import test from 'node:test';
import {requiresPracticeManagerLookup} from '../src/lib/adminPermissions.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUpload,validFileSignature,parseSelection,cleanSelection} from '../src/lib/modules/validation.ts';
import {calculatePrice} from '../src/lib/catalog/pricing.ts';
test('six module descriptions retain the supplied sequence and subjects',()=>{
 const rows=JSON.parse(readFileSync(new URL('../src/content/modules.json',import.meta.url),'utf8'));
 assert.deepEqual(rows.map((r:any)=>r.number),[1,2,3,4,5,6]);assert.equal(new Set(rows.map((r:any)=>r.slug)).size,6);
 assert.ok(rows[3].topics.includes('Hartcoherentie'));assert.ok(!rows[0].topics.includes('Hartcoherentie'));
});
test('mixed module/questionnaire examples use the shared cent allocation',()=>{
 for(const [prices,total] of [[[8900],8900],[[8900,8900],16910],[[8900,5900],14060],[[8900,8900,5900],22515],[[8900,8900,5900,5900],26640]] as [number[],number][]){
  const result=calculatePrice(prices.map((priceCents,i)=>({id:String(i),priceCents})),'custom');assert.equal(result.totalCents,total);assert.equal(result.lines.reduce((s,l)=>s+l.payableCents,0),total);
 }
});
test('selection preserves legacy links and rejects ambiguous input',()=>{
 assert.deepEqual(parseSelection(new URLSearchParams('producten=a,b')),{ids:['a','b'],mode:'custom'});
 assert.equal(parseSelection(new URLSearchParams('vragenlijsten=a')).mode,'custom');assert.equal(parseSelection(new URLSearchParams('pakket=a')).mode,'package');
 for(const query of ['', 'pakket=a&producten=b','vragenlijsten=a&producten=b'])assert.throws(()=>parseSelection(new URLSearchParams(query)));
 assert.deepEqual(cleanSelection(['b','b',null,'missing','a'],['a','b']),['b','a']);assert.deepEqual(cleanSelection({},['a']),[]);
});
test('upload metadata limits and content signatures reject mismatched material',()=>{
 assert.equal(validateUpload({kind:'audio',title:'Oefening',key:'oefening-1',size:100,sortOrder:1}).kind,'audio');
 for(const patch of [{kind:'video'},{size:0},{size:151*1024*1024},{key:'../escape'},{title:''},{sortOrder:-1}])assert.throws(()=>validateUpload({kind:'audio',title:'Oefening',key:'oefening-1',size:100,...patch}));
 assert.throws(()=>validateUpload({kind:'pdf',title:'Werkboek',size:26*1024*1024}));
 assert.equal(validFileSignature('pdf',new TextEncoder().encode('%PDF-1.7')),true);assert.equal(validFileSignature('audio',new Uint8Array([255,251,144,0])),true);
 assert.equal(validFileSignature('audio',new TextEncoder().encode('ID3')),true);assert.equal(validFileSignature('audio',new TextEncoder().encode('%PDF-1.7')),false);assert.equal(validFileSignature('pdf',new TextEncoder().encode('<html>')),false);
});

test('customer and superadmin sessions do not depend on extra practice grants',()=>{
 assert.equal(requiresPracticeManagerLookup(['customer']),false);
 assert.equal(requiresPracticeManagerLookup(['super_admin']),false);
 assert.equal(requiresPracticeManagerLookup(['employee']),true);
 assert.equal(requiresPracticeManagerLookup(['practitioner','customer']),true);
});
