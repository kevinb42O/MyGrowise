import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const load = (file, dependencies = {}) => {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), Request, Response, URL, URLSearchParams, Date, Intl }, { filename: file });
  return exports;
};
const { workdayBookings, brusselsDay } = load('../src/lib/practiceWorkday.ts');
const booking = (id, startsAt, endsAt, status = 'confirmed') => ({ id, startsAt, endsAt, status });

test('Vandaag retains elapsed and ongoing appointments and uses the Brussels day at UTC midnight', () => {
  const rows = [
    booking('elapsed', '2026-10-30T08:00:00Z', '2026-10-30T08:50:00Z'),
    booking('ongoing', '2026-10-30T12:00:00Z', '2026-10-30T13:00:00Z'),
    booking('future', '2026-10-30T15:00:00Z', '2026-10-30T15:50:00Z'),
    booking('cancelled', '2026-10-30T16:00:00Z', '2026-10-30T16:50:00Z', 'cancelled'),
    booking('next-day', '2026-10-30T23:30:00Z', '2026-10-31T00:20:00Z'),
  ];
  const result = workdayBookings(rows, new Date('2026-10-30T12:30:00Z'));
  assert.deepEqual(Array.from(result.today, row => row.id), ['elapsed', 'ongoing', 'future']);
  assert.deepEqual(Array.from(result.upcoming, row => row.id), ['next-day']);
  assert.deepEqual(Array.from(result.awaitingReport, row => row.id), ['elapsed']);
  assert.equal(brusselsDay('2026-10-30T23:30:00Z'), '2026-10-31');
});

test('Only completed or elapsed confirmed conversations require a report, including previous days', () => {
  const rows = ['completed', 'confirmed', 'no_show', 'declined', 'pending', 'cancelled'].map(status => booking(status, '2026-10-29T10:00:00Z', '2026-10-29T10:50:00Z', status));
  assert.deepEqual(Array.from(workdayBookings(rows, new Date('2026-10-30T12:00:00Z')).awaitingReport, row => row.id), ['completed', 'confirmed']);
  assert.equal(workdayBookings([], new Date()).today.length, 0);
});

test('Free slot total counts the whole fortnight independently of the four-item preview', async () => {
  const profile = { id: '11111111-1111-4111-8111-111111111111', slug: 'test', active: true, practitioner_settings: {} };
  const db = {
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; },
        maybeSingle: async () => ({data: profile, error: null}),
        then(resolve) { return Promise.resolve({data: table === 'availability_rules' ? [{weekday: 1, start_time: '09:00', end_time: '17:00'}] : [], error: null}).then(resolve); },
      };
      return query;
    },
    rpc: async () => ({data: Array.from({length: 17}, (_, index) => ({starts_at: new Date(Date.UTC(2026, 10, 2, index)).toISOString(), ends_at: new Date(Date.UTC(2026, 10, 2, index + 1)).toISOString()})), error: null}),
  };
  const { getPracticeSummary } = load('../src/lib/practiceStore.ts', {
    './supabase/server': {getSupabaseAdmin: () => db}, './brusselsTime': {}, './mijndiadSync': {ensurePracticeCalendarFresh: async () => {}},
  });
  const summary = await getPracticeSummary('test', []);
  assert.equal(summary.freeSlotCount, 17);
  assert.equal(summary.nextSlots.length, 4);
  assert.equal(summary.availabilityDays, 1);
});

const { clientRecordsBaseForRequest } = load('../src/lib/clientRecordNavigation.ts');
test('All dossier form redirects retain the chosen workspace and reject external referrers', () => {
  assert.equal(clientRecordsBaseForRequest(new Request('https://example.test/api/admin/clienten?werkruimte=praktijk')), '/praktijk/clienten');
  assert.equal(clientRecordsBaseForRequest(new Request('https://example.test/api/admin/clienten', {headers:{referer:'https://example.test/praktijk/clienten/123'}})), '/praktijk/clienten');
  assert.equal(clientRecordsBaseForRequest(new Request('https://example.test/api/admin/clienten', {headers:{referer:'https://evil.test/praktijk/clienten'}})), '/admin/clienten');
  assert.equal(clientRecordsBaseForRequest(new Request('https://example.test/api/admin/clienten?werkruimte=https://evil.test')), '/admin/clienten');
  assert.equal(clientRecordsBaseForRequest(new Request('https://example.test/api/admin/clienten?werkruimte=admin', {headers:{referer:'https://example.test/praktijk/clienten'}})), '/admin/clienten');
});

test('Creating a dossier from an appointment preserves that appointment for the report', async () => {
  const {POST} = load('../src/pages/api/admin/clienten/index.ts', {
    '../../../../lib/adminAuth': {isTrustedFormOrigin: () => true},
    '../../../../lib/securityAudit': {auditActor: () => ({})},
    '../../../../lib/clientRecordNavigation': {clientRecordsBaseForRequest},
    '../../../../lib/clientRecords': {createPatientFromBooking: async () => 'patient-123'},
  });
  const request = new Request('https://example.test/api/admin/clienten?werkruimte=praktijk', {method:'POST',body:new URLSearchParams({operation:'from_booking',booking_id:'booking-123'})});
  const result = await POST({request,locals:{currentUser:{}},redirect:(location,status)=>new Response(null,{status,headers:{location}})});
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('location'), '/praktijk/clienten/patient-123?melding=afspraak&boeking=booking-123#nieuw-verslag');
});

test('The work queue suppresses reported conversations and drafts owned by another clinician', async () => {
  const old = {startsAt:'2026-10-29T09:00:00Z',endsAt:'2026-10-29T09:50:00Z',status:'completed'};
  const allBookings = [
    {...old,id:'already-reported',patientId:'assigned',clientName:'Assigned'},
    {...old,id:'needs-report',patientId:'assigned',clientName:'Assigned'},
    {...old,id:'unassigned',patientId:'someone-else',clientName:'Someone else'},
    {...old,id:'unlinked',patientId:null,clientName:'New client'},
  ];
  const {loadPracticeWorkdayPage} = load('../src/lib/practiceWorkdayPage.ts', {
    './practiceStore': {listBookings:async()=>allBookings,getPracticeSummary:async()=>({pending:0,nextSlots:[],freeSlotCount:0})},
    './clientRecords': {getPracticeNoteTasks:async()=>({patients:[{id:'assigned',fullName:'Assigned'}],notes:[
      {id:'own-draft',patient_id:'assigned',booking_id:'already-reported',status:'draft',created_by:'clinician'},
      {id:'other-draft',patient_id:'assigned',booking_id:null,status:'draft',created_by:'colleague'},
    ]})},
    './adminAuth': {hasPermission:()=>true}, './practiceWorkday':{workdayBookings:()=>({today:[],upcoming:[],awaitingReport:allBookings})},
  });
  const data = await loadPracticeWorkdayPage({locals:{currentUser:{sub:'clinician',practitionerId:'clinician',roles:['practitioner']}},url:new URL('https://example.test/praktijk')});
  assert.deepEqual(Array.from(data.tasks, task=>task.id), ['own-draft','needs-report','unlinked']);
  assert.equal(data.tasks[0].href, '/praktijk/clienten/assigned?concept=own-draft#verslag-own-draft');
  assert.equal(data.tasks[1].href, '/praktijk/clienten/assigned?boeking=needs-report#nieuw-verslag');
});

test('Report creation and draft updates return to the practice workspace', async () => {
  const noteCreate = load('../src/pages/api/admin/clienten/[id]/notities.ts', {
    '../../../../../lib/adminAuth': {isTrustedFormOrigin:()=>true},
    '../../../../../lib/securityAudit': {auditActor:()=>({})},
    '../../../../../lib/clientRecordNavigation': {clientRecordsBaseForRequest},
    '../../../../../lib/clientRecords': {createPatientNote:async(input)=>{assert.equal(input.bookingId,'booking-123');}},
  });
  const redirect = (location,status)=>new Response(null,{status,headers:{location}});
  const response = await noteCreate.POST({request:new Request('https://example.test/api/admin/clienten/patient-123/notities?werkruimte=praktijk',{method:'POST',body:new URLSearchParams({booking_id:'booking-123',submit_status:'final'})}),params:{id:'patient-123'},locals:{currentUser:{}},redirect});
  assert.equal(response.headers.get('location'), '/praktijk/clienten/patient-123?melding=definitief#verslagen');
  const noteUpdate = load('../src/pages/api/admin/notities/[id].ts', {
    '../../../../lib/adminAuth': {isTrustedFormOrigin:()=>true},
    '../../../../lib/securityAudit': {auditActor:()=>({})},
    '../../../../lib/clientRecordNavigation': {clientRecordsBaseForRequest},
    '../../../../lib/clientRecords': {getPatientByNote:async()=>({patientId:'patient-123'}),savePatientNoteVersion:async()=>({patientId:'patient-123'})},
  });
  const updated = await noteUpdate.POST({request:new Request('https://example.test/api/admin/notities/note-123?werkruimte=praktijk&pagina=2',{method:'POST',body:new URLSearchParams({submit_status:'final'})}),params:{id:'note-123'},locals:{currentUser:{}},redirect});
  assert.equal(updated.headers.get('location'), '/praktijk/clienten/patient-123?melding=definitief&concept=note-123&pagina=2#verslag-note-123');
});
