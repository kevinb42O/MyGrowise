import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseLandingContent,parseAudienceGroups,matchesAudience,landingFieldsFromForm} from '../src/lib/catalog/landing.ts';

const entries=JSON.parse(readFileSync(new URL('../docs/content/questionnaire-landings.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../docs/content/enkelvoudige-vragenlijsten-brontekst.txt',import.meta.url),'utf8');
const general=JSON.parse(readFileSync(new URL('../src/content/questionnaireInformation.json',import.meta.url),'utf8'));

test('all 22 complete source texts survive structuring, including limitations and lists',()=>{
  const blocks=source.split(/^\d+\. /m).slice(1);
  assert.equal(entries.length,22);assert.equal(new Set(entries.map((e:any)=>e.slug)).size,22);
  entries.forEach((entry:any,index:number)=>{
    assert.ok(parseLandingContent(entry.landingContent),entry.slug);
    assert.ok(parseAudienceGroups(entry.audienceGroups));
    assert.ok(entry.title.length<=120);assert.ok(entry.summary.length>=20&&entry.summary.length<=320);
    const lines=blocks[index].split('\n').map(line=>line.trim()).filter(Boolean);
    assert.equal(entry.title,lines[0]);assert.equal(entry.landingContent.question,lines[2]);
    const measures=lines.indexOf('Wat brengt deze vragenlijst in kaart?'),expectations=lines.indexOf('Wat mag je verwachten?'),disclaimer=lines.findIndex(line=>line.startsWith('Belangrijk:'));
    assert.deepEqual(entry.landingContent.introduction,lines.slice(3,measures));
    assert.deepEqual(entry.landingContent.measures,lines.slice(measures+1,expectations).map(line=>line.replace(/^•\s*/,'').replace('Autismenspectrumgerelateerde','Autismespectrumgerelateerde')));
    assert.deepEqual(entry.landingContent.expectations,lines.slice(expectations+1,disclaimer));
    assert.equal(entry.landingContent.disclaimer,lines[disclaimer].replace('Belangrijk: ',''));
    assert.equal(`${entry.landingContent.formatLabel} | ${entry.landingContent.reportLabel}`,lines[disclaimer+1]);
    assert.equal(entry.priceCents,Number(lines[disclaimer+2].split('€')[1])*100);
  });
  for(const block of general){assert.ok(source.includes(block.title));for(const paragraph of block.paragraphs)assert.ok(source.includes(paragraph));}
});

test('audience boundaries include adolescent and adult overlap; old products still filter',()=>{
  const includes=(slug:string,group:string)=>matchesAudience(entries.find((e:any)=>e.slug===slug),group);
  for(const slug of ['neo-pi-3','sds','mini-scl']){assert.equal(includes(slug,'adolescents'),true);assert.equal(includes(slug,'adults'),true);assert.equal(includes(slug,'children'),false);}
  for(const group of ['children','adolescents','adults']){assert.equal(includes('cdi-2',group),true);assert.equal(includes('spm-2',group),true);}
  assert.equal(includes('brief-a','adolescents'),false);
  assert.equal(matchesAudience({audience:'Kinderen en jongeren'},'adolescents'),true);
  assert.equal(matchesAudience({audience:'Volwassenen'},'adults'),true);
  assert.equal(matchesAudience({audience:'Volwassenen'},'constructor'),false);
});

test('invalid or partial content cannot be published; malformed groups fail closed',()=>{
  const content=entries[0].landingContent;
  for(const patch of [{schemaVersion:2},{question:''},{measures:['']},{measures:Array(25).fill('test')},{introduction:['x'.repeat(2001)]},{disclaimer:null},{unknown:'field'}])assert.equal(parseLandingContent({...content,...patch}),null);
  for(const groups of [['adults','adults'],['constructor'],['__proto__'],['other'],[null],'adults'])assert.equal(parseAudienceGroups(groups),null);
});

test('editor round trips all content and distinguishes an old call from intentional clearing',()=>{
  assert.deepEqual(landingFieldsFromForm(new FormData()),{});
  const form=new FormData();form.set('landingFieldsPresent','1');
  assert.deepEqual(landingFieldsFromForm(form),{landingContent:null,audienceGroups:[]});
  form.set('landing-question','Only a partial form');assert.throws(()=>landingFieldsFromForm(form));
  const content=entries[0].landingContent;
  for(const [key,value] of Object.entries(content)){if(key!=='schemaVersion')form.set(`landing-${key}`,Array.isArray(value)?value.join('\r\n'):String(value));}
  assert.throws(()=>landingFieldsFromForm(form),/doelgroep/);
  form.append('audienceGroup','children');form.append('audienceGroup','adolescents');
  assert.deepEqual(landingFieldsFromForm(form),{landingContent:content,audienceGroups:['children','adolescents']});
});
