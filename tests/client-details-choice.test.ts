import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patientAge,brusselsToday} from '../src/lib/patientAge.ts';
import {salutationLabels,patientGreeting} from '../src/lib/patientSalutation.ts';
import {parsePatientDetails} from '../src/lib/patientDetails.ts';
import {bookingMailContent} from '../src/lib/bookingMailContent.ts';
import {appointmentChoices,appointmentTherapists,initialPractitioner} from '../src/lib/appointmentChoices.ts';

test('age follows calendar birthdays including leap-day and year boundary',()=>{
 for(const [birth,today,expected] of [
  ['1988-11-17','2026-11-16',37],['1988-11-17','2026-11-17',38],['1988-11-17','2026-11-18',38],
  ['2000-01-01','2025-12-31',25],['2000-01-01','2026-01-01',26],
  ['2000-02-29','2025-02-28',24],['2000-02-29','2025-03-01',25],['2000-02-29','2024-02-29',24],
  ['2026-11-17','2026-11-17',0],['2026-11-18','2026-11-17',null],['','2026-11-17',null],
  ['2025-02-29','2026-11-17',null],['2026-04-31','2026-11-17',null],['invalid','2026-11-17',null],
 ] as const)assert.equal(patientAge(birth,today),expected,`${birth} / ${today}`);
 assert.equal(brusselsToday(new Date('2026-12-31T23:30:00Z')),'2027-01-01');
 assert.equal(brusselsToday(new Date('2026-07-01T22:30:00Z')),'2026-07-02');
});
test('all stable salutations round-trip validation and mail rendering in every mail kind',()=>{
 const expected:Record<string,string>={'':'Beste','heer':'Geachte heer','meneer':'Geachte meneer','mevrouw':'Geachte mevrouw',heer_mevrouw:'Geachte heer/mevrouw',guardians:'Geachte ouder(s)/verzorger(s) van',couple:'Geacht echtpaar'};
 for(const salutation of Object.keys(salutationLabels)){
  const details=parsePatientDetails({first_name:'Anne Marie',last_name:'Van den Berg',email:'test@example.invalid',salutation});
  assert.equal(details.first_name,'Anne Marie');assert.equal(details.last_name,'Van den Berg');assert.equal(details.email,'test@example.invalid');assert.equal(details.salutation,salutation);
  for(const kind of ['confirmation','rescheduled','cancelled','reminder']){
   const mail=bookingMailContent(kind,{salutation,name:'Anne <&> Van den Berg',appointment:'Synthetische afspraak',practitioner:'Test',startsAt:'2026-11-25T10:00:00Z',endsAt:'2026-11-25T11:00:00Z',channel:'online'});
   assert.ok(mail.text.startsWith(`${expected[salutation]} Anne <&> Van den Berg,`));
   assert.ok(mail.html.includes(`${expected[salutation]} Anne &lt;&amp;&gt; Van den Berg,`));
   assert.ok(!mail.html.includes('Anne <&>'));
  }
 }
 assert.throws(()=>parsePatientDetails({first_name:'Anne',last_name:'Test',salutation:'__proto__'}));
 assert.equal(patientGreeting('Test','old_unknown_value'),'Beste Test,');
});
test('therapist choices scale to 20, sort in Dutch and preserve explicit valid selections',()=>{
 const offers=Array.from({length:20},(_,n)=>({id:`offer-${n}`,practitionerId:`p-${n}`,practitionerName:`Therapeut ${20-n}`,name:n%2?'Zorg':'Één gesprek',duration:60,channel:'online',location:''}));
 assert.equal(appointmentTherapists(offers).length,20);
 assert.equal(appointmentTherapists(offers)[0].name,'Therapeut 1');
 assert.equal(initialPractitioner(offers),'');
 assert.equal(initialPractitioner(offers,'p-9'),'p-9');
 assert.equal(initialPractitioner(offers,'forged'),'');
 assert.equal(initialPractitioner([offers[0]]),'p-0');
 assert.deepEqual(appointmentChoices(offers,''),[]);
 const extra=[{...offers[0],id:'short',name:'Één gesprek',duration:30},{...offers[0],id:'last',name:'Zorg'}];
 const choices=appointmentChoices([...offers,...extra],'p-0');
 assert.deepEqual(choices.map(o=>o.id),['short','offer-0','last']);
 assert.ok(choices.every(o=>o.practitionerId==='p-0'));
 assert.ok(!appointmentChoices(offers,'p-1').some(o=>o.id===choices[0].id));
});
