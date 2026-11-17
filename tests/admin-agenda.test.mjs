import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const load = (path, dependencies) => {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: path,
  });
  vm.runInNewContext(outputText, {
    exports, require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    Response, Date, setTimeout, URLSearchParams,
  }, { filename: path });
  return exports;
};

const person = '11111111-1111-4111-8111-111111111111';
const row = (id, scope) => ({ id, calendar_scope: scope, title: 'Eigen moment',
  starts_at: '2026-10-19T10:00:00Z', ends_at: '2026-10-19T11:00:00Z',
  status: 'confirmed', event_kind: 'personal', location: '', color: '#1f7060', practitioner_id: person });
const input = { title: 'MyGrowise moment', startsAt: '2026-10-19T12:00:00Z', endsAt: '2026-10-19T13:00:00Z',
  kind: 'personal', location: '', color: '#1f7060', practitionerId: person, calendarScope: 'mygrowise' };
const actor = { userId: person, email: 'test@example.invalid' };

const from = '2026-10-19T00:00:00Z';
const to = '2026-10-20T00:00:00Z';
const revision = '2026-10-18T08:11:00.123456+00:00';

// Stub the storage boundary while exercising real validation, range reads and RPC payloads.
const setup = () => {
  const rows = [row('mygrowise-event', 'mygrowise'), row('itransform-event', 'itransform')];
  const bookingRows = [];
  const rpcCalls = [];
  const busyBlocks = [];
  const offers = [];
  const tables = { practice_calendar_events: rows, bookings: bookingRows };
  const queryFor = data => {
    const filters = [];
    const query = {
      select() { return query; }, order() { return query; },
      eq(key, value) { filters.push(r => r[key] === value); return query; },
      lt(key, value) { filters.push(r => r[key] < value); return query; },
      gt(key, value) { filters.push(r => r[key] > value); return query; },
      in(key, values) { filters.push(r => values.includes(r[key])); return query; },
      range(start, end) { return Promise.resolve({ data: data.filter(r => filters.every(matches => matches(r))).slice(start, end + 1), error: null }); },
    };
    return query;
  };
  const db = {
    from(table) { return queryFor(tables[table] || []); },
    rpc(name, args) {
      if (name === 'agenda_private_occupancy') return queryFor(busyBlocks);
      if (name === 'agenda_offer_availability') return queryFor(offers);
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: { id: args.p_id || 'new-event' }, error: null });
    },
  };
  const supabase = { getSupabaseAdmin: () => db };
  const helpers = load('../src/lib/agendaData.ts', { './supabase/server': supabase });
  const dependencies = { './supabase/server': supabase, './agendaData': helpers };
  const service = load('../src/lib/adminAgenda.ts', dependencies);
  const practiceService = load('../src/lib/practiceAgenda.ts', dependencies);
  return { service, practiceService, rows, rpcCalls, busyBlocks, offers, bookingRows, helpers };
};

test('admin agenda returns MyGrowise events and excludes Itransform', async () => {
  const { service, busyBlocks } = setup();
  busyBlocks.push({id:'anonymous',practitioner_id:person,practitioner_name:'Therapeut',starts_at:from,ends_at:to,private_reason:'geheim'});
  const events = await service.listAgendaEvents(from, to);
  assert.equal(events.length, 2);
  assert.ok(events.some(event => event.id === 'mygrowise-event' && event.source === 'mygrowise'));
  const busy = events.find(event => event.id === 'anonymous');
  assert.equal(busy.title,'Niet beschikbaar');
  assert.doesNotMatch(JSON.stringify(busy),/geheim|Itransform/);
});

test('organization agenda preserves the authenticated owner’s private colours and removes only its duplicate busy block', async () => {
  const { service, rows, busyBlocks } = setup();
  const privateEvent=rows.find(event=>event.id==='itransform-event');
  Object.assign(privateEvent,{title:'EMDR online',color:'#326b9e',event_kind:'appointment',
    external_source:'mijndiad',external_url:'https://praktijkitransform.mijndiad.nl/appointments/123',practitioners:{name:'Virginie'}});
  const hex=createHash('md5').update('event:itransform-event').digest('hex');
  const duplicateId=hex.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
  const occupancy={practitioner_id:person,practitioner_name:'Virginie',starts_at:privateEvent.starts_at,ends_at:privateEvent.ends_at};
  busyBlocks.push({...occupancy,id:duplicateId},{...occupancy,id:'separate-exception'});
  rows.push({...privateEvent,id:'another-private-event',practitioner_id:'another-owner',title:'Private other therapist'});
  for(const filter of [undefined,person]){
    const events=await service.listAgendaEvents(from,to,filter,person);
    const own=events.find(event=>event.id===privateEvent.id);
    assert.equal(own.title,'EMDR online');assert.equal(own.color,'#326b9e');
    assert.equal(own.externalSource,'mijndiad');assert.equal(own.editable,false);
    assert.equal(own.externalUrl,privateEvent.external_url);
    assert.ok(!events.some(event=>event.id===duplicateId));
    assert.ok(events.some(event=>event.id==='separate-exception'));
    assert.ok(!events.some(event=>event.id==='another-private-event'));
  }
  const anotherViewer=await service.listAgendaEvents(from,to,person,'another-owner');
  assert.ok(!anotherViewer.some(event=>event.id===privateEvent.id));
  assert.ok(anotherViewer.some(event=>event.id===duplicateId && event.title==='Niet beschikbaar'));
  const otherFilter=await service.listAgendaEvents(from,to,'another-owner',person);
  assert.ok(!otherFilter.some(event=>event.source==='itransform'));
});

test('organization API uses the session owner and never a URL-supplied viewer identity', async () => {
  const calls=[];
  const route=load('../src/pages/api/admin/agenda.ts',{
    '../../../lib/adminAgenda':{listAgendaEvents:async(...args)=>{calls.push(args);return [];},listAgendaPractitioners:async()=>[]},
    '../../../lib/agendaData':setup().helpers,
    '../../../lib/adminAuth':{},'../../../lib/securityAudit':{},
  });
  const response=await route.GET({url:new URL(`https://example.invalid/api/admin/agenda?from=${from}&to=${to}&practitioner=${person}&viewerPractitionerId=${person}`),locals:{adminUser:{practitionerId:'authenticated-owner'}}});
  assert.equal(response.status,200);
  assert.equal(calls[0][3],'authenticated-owner');
});

test('admin rejects Itransform assignments and requires a MyGrowise professional', async () => {
  const { service, rows } = setup();
  for (const method of ['createPracticeAgendaEvent', 'updatePracticeAgendaEvent']) {
    for (const invalid of [{ ...input, calendarScope: 'itransform' }, { ...input, practitionerId: null }]) {
      const args = method.startsWith('update') ? ['mygrowise-event', invalid, actor] : [invalid, actor];
      assert.throws(() => service[method](...args), /invalid_event/);
    }
  }
  assert.equal(rows.length, 2);
});

test('writes carry the actor, revision and scoped operation to one RPC', async () => {
  const { service, practiceService, rpcCalls } = setup();
  await service.createPracticeAgendaEvent(input, actor);
  await service.movePracticeAgendaEvent('mygrowise-event', input.startsAt, input.endsAt, actor, revision);
  await practiceService.deleteOwnedAgendaEvent(person, 'mygrowise-event', actor, revision);
  assert.equal(rpcCalls.length, 3);
  const [,move,remove] = rpcCalls;
  assert.equal(move.args.p_mode, 'admin');
  assert.equal(move.args.p_revision, revision);
  assert.equal(move.args.p_actor, person);
  assert.equal(Object.keys(move.args.p_values).sort().join(','), 'ends_at,starts_at');
  assert.equal(remove.args.p_mode,'practice');
  assert.equal(remove.args.p_practitioner,person);
  assert.equal(remove.name,'mutate_agenda_item');
});

test('range reads page beyond the Data API cap with stable filters', async () => {
  const { service, rows } = setup();
  rows.push(...Array.from({length:1008}, (_, index) => row(`paged-${index}`, 'mygrowise')));
  assert.equal((await service.listAgendaEvents(from,to,person)).length,1009);
});

const routeSetup = () => {
  const calls = [];
  const route = load('../src/pages/api/admin/agenda.ts', {
    '../../../lib/adminAgenda': {
      createPracticeAgendaEvent: async value => { calls.push(value); return { id: person }; },
      updatePracticeAgendaEvent: async (id, value) => { calls.push(value); return { id }; },
    },
    '../../../lib/agendaData': setup().helpers,
    '../../../lib/adminAuth': { isTrustedFormOrigin: () => true },
    '../../../lib/securityAudit': { auditActor: () => actor },
  });
  return { route, calls };
};

test('admin API defaults omitted scope to MyGrowise and rejects other scopes', async () => {
  for (const method of ['POST', 'PATCH']) {
    const { route, calls } = routeSetup();
    const context = body => ({ request: { json: async () => ({ ...body, revision }) }, locals: {}, url: new URL(`https://example.invalid/api/admin/agenda?id=${person}`) });
    const { calendarScope, ...withoutScope } = input;
    const response = await route[method](context(withoutScope));
    assert.equal(response.status, method === 'POST' ? 201 : 200);
    assert.equal(calls[0].calendarScope, 'mygrowise');
    for (const scope of ['itransform', 'other', '', null]) {
      const denied = await route[method](context({ ...input, calendarScope: scope }));
      assert.equal(denied.status, 400);
    }
    assert.equal(calls.length, 1);
  }
});

const { default: Agenda, AgendaEventCard, ImportedAgendaDetails, eventForeground } = load('../src/components/admin/UnifiedAgenda.tsx', {
  '@fullcalendar/react': { __esModule: true, default: () => null },
  ...Object.fromEntries(['daygrid', 'timegrid', 'interaction', 'list', 'luxon3'].map(name => [`@fullcalendar/${name}`, {}])),
  '@fullcalendar/core/locales/nl': {},
  '../../lib/brusselsTime': {},
  './AgendaClientPicker': {}, './AgendaDialog': {},
});

test('admin UI has no Itransform filter, even if practice access is supplied', () => {
  for (const allowItransform of [false, true]) {
    const html = renderToStaticMarkup(createElement(Agenda, { mode: 'admin', allowItransform }));
    assert.doesNotMatch(html, /Itransform|Agenda filter/);
    assert.match(html, /Professional/);
    assert.match(html, /Nieuw moment/);
  }
});

test('practice agenda retains its existing scope filters for authorized users', () => {
  const html = renderToStaticMarkup(createElement(Agenda, { mode: 'practice', allowItransform: true }));
  assert.match(html, /Praktijk Itransform/);
  assert.match(html, /MyGrowise/);
});

test('MijnDiAd blocks are read-only and only appear in their owner practice agenda', async () => {
  const { practiceService, service, rows } = setup();
  rows.push({ ...row('external-event', 'itransform'), external_source: 'mijndiad' });
  rows.push({ ...row('someone-elses-event', 'itransform'), practitioner_id: 'someone-else', external_source: 'mijndiad' });
  const { events } = await practiceService.listPracticeAgenda(person, from, to, true);
  assert.equal(events.find(e => e.id === 'external-event').editable, false);
  assert.match(events.find(e => e.id === 'external-event').subtitle, /MijnDiAd/);
  assert.ok(!events.some(e => e.id === 'someone-elses-event'));
  const { events: withoutAccess } = await practiceService.listPracticeAgenda(person, from, to, false);
  assert.ok(!withoutAccess.some(e => e.source === 'itransform'));
  const adminEvents = await service.listAgendaEvents('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z');
  assert.ok(!adminEvents.some(e => e.id === 'external-event'));
});

test('practice agenda keeps completed appointments, labels overlaps and retains exact typed slots', async () => {
  const { practiceService, rows, bookingRows, offers } = setup();
  rows.push({...row('external-event','itransform'),external_source:'mijndiad'});
  bookingRows.push(
    {...row('confirmed-booking','mygrowise'),client_name:'Cliënt',status:'confirmed',channel:'online'},
    {...row('completed-booking','mygrowise'),client_name:'Cliënt',status:'completed',location:'Brugge'},
  );
  offers.push({offer_id:'offer',offer_name:'Consult van 30 min',slots:[['2026-10-19T11:15:00Z','2026-10-19T11:45:00Z']]});
  const { events } = await practiceService.listPracticeAgenda(person,from,to,true);
  assert.equal(events.find(row => row.id === 'confirmed-booking').conflict,true);
  assert.equal(events.find(row => row.id === 'confirmed-booking').location,'Online');
  assert.equal(events.find(row => row.id === 'completed-booking').status,'completed');
  assert.equal(events.find(row => row.source === 'availability').startsAt, '2026-10-19T11:15:00Z');
});

test('event text remains legible on light and dark custom colours', () => {
  assert.equal(eventForeground('#d97706'),'#000000');
  assert.equal(eventForeground('#ffffff'),'#000000');
  assert.equal(eventForeground('#1f7060'),'#ffffff');
});

test('agenda time input requires an offset and a real calendar date', () => {
  const { agendaInstant } = setup().helpers;
  assert.equal(agendaInstant('2026-02-30T08:00:00Z'),false);
  assert.equal(agendaInstant('2026-10-30T08:00'),false);
  assert.equal(agendaInstant(revision),true);
});

test('imported event cards show actual appointment type and location', () => {
  const item = { title:'EMDR ONLINE', location:'Online', externalSource:'mijndiad', source:'itransform', status:'confirmed' };
  const html = renderToStaticMarkup(createElement(AgendaEventCard, {item,timeText:'10:00 – 11:00'}));
  assert.match(html,/EMDR ONLINE/); assert.match(html,/Online/);
  assert.doesNotMatch(html,/Bezet — MijnDiAd|Itransform ·/);
});

test('imported details explain missing identities and only expose safe appointment links', () => {
  const item = {title:'EMDR',kind:'appointment',location:'Brugge',externalSource:'mijndiad',startsAt:'2026-10-19T08:00:00Z',endsAt:'2026-10-19T09:00:00Z',externalUrl:'https://praktijkitransform.mijndiad.nl/appointments/123'};
  const html = renderToStaticMarkup(createElement(ImportedAgendaDetails,{item}));
  assert.match(html,/60 minuten/); assert.match(html,/Brugge/);
  assert.match(html,/Niet meegeleverd door MijnDiAd/); assert.match(html,/appointments\/123/);
  const unsafe = renderToStaticMarkup(createElement(ImportedAgendaDetails,{item:{...item,externalUrl:'javascript:alert(1)'}}));
  assert.doesNotMatch(unsafe,/href=|javascript:/);
});
