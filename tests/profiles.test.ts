import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProfileLanding,profileMatchesAge,profileFieldsFromForm,profileCountLabel} from '../src/lib/catalog/profiles.ts';
const entries=JSON.parse(readFileSync(new URL('../docs/content/profile-landings.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../docs/content/profielpakketten-brontekst.txt',import.meta.url),'utf8');
test('all eight supplied profiles retain every paragraph, instrument and limitation',()=>{
 const blocks=source.split(/^\d+\. /m).slice(1);assert.equal(entries.length,8);
 for(const [index,e] of entries.entries()){
  assert.ok(parseProfileLanding(e.content),e.slug);
  const lines=blocks[index].split('\n').map(s=>s.trim()).filter(Boolean);
  const m=lines.indexOf('Wat brengt dit profiel in kaart?'),i=lines.indexOf('Welke vragenlijsten worden afgenomen?'),x=lines.indexOf('Wat mag je verwachten?'),d=lines.findIndex(s=>s.startsWith('Belangrijk:'));
  assert.equal(e.content.question,lines[2]);assert.deepEqual(e.content.introduction,lines.slice(3,m));assert.deepEqual(e.content.measures,lines.slice(m+1,i).map(s=>s.replace(/^•\s*/,'')));assert.deepEqual(e.content.instrumentLines,lines.slice(i+1,x));assert.deepEqual(e.content.expectations,lines.slice(x+1,d));assert.equal(e.content.disclaimer,lines[d].replace('Belangrijk: ',''));assert.equal(`${e.content.formatLabel} | ${e.content.reportLabel}`,lines[d+1]);
 }
});
test('profile age groups reflect overlap and variants rather than audience words',()=>{
 for(const [age,count] of [['',8],['children',3],['adolescents',2],['adults',6]] as const) assert.equal(entries.filter((e:any)=>profileMatchesAge(e.content,age)).length,count);
 const c=entries[5].content;for(const group of ['children','adolescents','adults'])assert.equal(profileMatchesAge(c,group),true);
 assert.equal(profileMatchesAge(c,'constructor'),false);assert.equal(profileMatchesAge(null,'adults'),false);
 assert.match(profileCountLabel(entries[0].content),/^6 vragenlijsten \+ 1 eigen/);assert.equal(profileCountLabel(c),'2 vragenlijsten');
});
test('profile editor round trips all fields and preserves content for old submissions',()=>{
 assert.deepEqual(profileFieldsFromForm(new FormData()),{});
 const f=new FormData();f.set('profileFieldsPresent','1');assert.deepEqual(profileFieldsFromForm(f),{profileLanding:null});
 const c=entries[0].content;for(const [key,val] of Object.entries(c)){if(key==='themes')for(const t of val as string[])f.append('profile-theme',t);else if(key!=='schemaVersion')f.set(`profile-${key}`,Array.isArray(val)?val.join('\r\n'):val===null?'':String(val));}
 assert.deepEqual(profileFieldsFromForm(f),{profileLanding:c});f.set('profile-ageMax','2');assert.throws(()=>profileFieldsFromForm(f));
 for(const patch of [{ageMin:-1},{ageMax:1},{themes:['constructor']},{themes:['Persoonlijkheid','Persoonlijkheid']},{instrumentCount:0},{ownCount:31},{question:''},{instrumentLines:[]},{extra:true}])assert.equal(parseProfileLanding({...c,...patch}),null);
});
