import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePatientDetails} from '../src/lib/patientDetails.ts';
import {bookingMailContent} from '../src/lib/bookingMailContent.ts';
import {hasAdminPermission,requiredAdminPermission} from '../src/lib/adminPermissions.ts';
const base={first_name:'  Anne Marie ',last_name:'De Vries',birth_date:'1980-02-29',mobile:'+32 400 00 00 00',country:'be'};
test('structured details preserve names and normalize only intended fields',()=>{
 const d=parsePatientDetails({...base,national_number:'80.02.29-123.45'},true);
 assert.equal(d.first_name,'Anne Marie');assert.equal(d.last_name,'De Vries');assert.equal(d.country,'BE');assert.equal(d.national_number,'80022912345');assert.equal(d.intake_date,'');
});
test('booking requires birth date and mobile and rejects impossible dates',()=>{
 assert.throws(()=>parsePatientDetails({...base,birth_date:'2025-02-29'},true));
 assert.throws(()=>parsePatientDetails({...base,mobile:''},true));
 assert.throws(()=>parsePatientDetails({...base,mobile:'ongeldig'},true));
 assert.throws(()=>parsePatientDetails({...base,birth_date:'2999-01-01'},true));
 assert.throws(()=>parsePatientDetails({...base,gender:'invalid'},true));
 assert.throws(()=>parsePatientDetails({...base,national_number:'123'},true));
 assert.throws(()=>parsePatientDetails({...base,last_name:'x'.repeat(61)},true));
});
test('confirmation includes full appointment type, therapist and Belgian time',()=>{
 const mail=bookingMailContent('confirmation',{name:'Test Cliënt',appointment:'Intake EMDR – online',practitioner:'Virginie',startsAt:'2026-10-20T08:00:00Z',endsAt:'2026-10-20T09:00:00Z',channel:'online',instructions:'Je therapeut stuurt de online-link.'});
 assert.match(mail.subject,/bevestigd: Intake EMDR/);assert.match(mail.text,/Beste Test Cliënt,/);assert.match(mail.text,/10:00/);assert.match(mail.text,/Virginie/);assert.match(mail.text,/online-link/);assert.doesNotMatch(mail.text,/goedkeur|aanvraag/);
});
test('winter time and cancellation use appropriate message',()=>{
 const mail=bookingMailContent('cancelled',{name:'Test',salutation:'mevrouw',appointment:'Psychologiesessie – online',practitioner:'Margot',startsAt:'2026-11-20T09:00:00Z',endsAt:'2026-11-20T10:00:00Z',channel:'online',instructions:'Join secret session'});
 assert.match(mail.subject,/geannuleerd/);assert.match(mail.text,/Geachte mevrouw Test,/);assert.match(mail.text,/10:00/);assert.doesNotMatch(mail.text,/Join secret/);
});
test('practice management routes are registered and denied to ordinary client/support roles',()=>{
 for(const path of ['/admin/afspraaktypes','/admin/boekingslinks','/admin/therapeuten','/admin/afspraken/nieuw']){
 assert.equal(requiredAdminPermission(path,'POST'),'practice.manage');
 assert.equal(hasAdminPermission(['customer'],'practice.manage'),false);
 assert.equal(hasAdminPermission(['support'],'practice.manage'),false);
 assert.equal(hasAdminPermission(['super_admin'],'practice.manage'),true);
 }
 assert.equal(requiredAdminPermission('/api/admin/clienten/id/sessiedata'),'client_records.read');
 assert.equal(requiredAdminPermission('/api/admin/unknown','POST'),null);
});
