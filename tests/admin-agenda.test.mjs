import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const require = createRequire(import.meta.url);
const load = (path, dependencies) => {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: path,
  });
  vm.runInNewContext(outputText, {
    exports, require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    Response, Date, setTimeout,
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

// Exercise the actual service and route code against an in-memory Supabase adapter.
const setup = () => {
  const rows = [row('mygrowise-event', 'mygrowise'), row('itransform-event', 'itransform')];
  const audits = [];
  const db = { from(table) {
    let operation = 'select'; let values; const filters = [];
    const query = {
      select() { return query; }, order() { return query; },
      eq(key, value) { filters.push(r => r[key] === value); return query; },
      lt(key, value) { filters.push(r => r[key] < value); return query; },
      gt(key, value) { filters.push(r => r[key] > value); return query; },
      in(key, values) { filters.push(r => values.includes(r[key])); return query; },
      insert(value) { operation = 'insert'; values = value; return query; },
      update(value) { operation = 'update'; values = value; return query; },
      delete() { operation = 'delete'; return query; },
      single() { return execute(true); }, maybeSingle() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };
    async function execute(single) {
      if (table !== 'practice_calendar_events') return { data: [], error: null };
      let selected = rows.filter(r => filters.every(matches => matches(r)));
      if (operation === 'insert') { const created = { id: 'new-event', status: 'confirmed', ...values }; rows.push(created); selected = [created]; }
      if (operation === 'update') selected.forEach(r => Object.assign(r, values));
      if (operation === 'delete') selected.forEach(r => rows.splice(rows.indexOf(r), 1));
      return { data: single ? selected[0] || null : selected, error: null };
    }
    return query;
  } };
  const service = load('../src/lib/adminAgenda.ts', {
    './supabase/server': { getSupabaseAdmin: () => db },
    './securityAudit': { writeSecurityAudit: async audit => audits.push(audit) },
  });
  const practiceService = load('../src/lib/practiceAgenda.ts', {
    './supabase/server': { getSupabaseAdmin: () => db },
    './practiceStore': { getBookableSlots: async () => [] },
    './securityAudit': { writeSecurityAudit: async audit => audits.push(audit) },
  });
  return { service, practiceService, rows, audits };
};

test('admin agenda returns MyGrowise events and excludes Itransform', async () => {
  const { service } = setup();
  const events = await service.listAgendaEvents('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z');
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'mygrowise-event');
  assert.equal(events[0].source, 'mygrowise');
  assert.equal(events[0].subtitle, 'MyGrowise');
});

test('admin rejects Itransform assignments and requires a MyGrowise professional', async () => {
  const { service, rows } = setup();
  for (const method of ['createPracticeAgendaEvent', 'updatePracticeAgendaEvent']) {
    for (const invalid of [{ ...input, calendarScope: 'itransform' }, { ...input, practitionerId: null }]) {
      const args = method.startsWith('update') ? ['mygrowise-event', invalid, actor] : [invalid, actor];
      await assert.rejects(service[method](...args), /invalid_event/);
    }
  }
  assert.equal(rows.length, 2);
});

test('admin cannot update, convert or delete an Itransform event by ID', async () => {
  const { service, rows, audits } = setup();
  await assert.rejects(service.updatePracticeAgendaEvent('itransform-event', input, actor), /not_found/);
  await assert.rejects(service.deletePracticeAgendaEvent('itransform-event', actor), /not_found/);
  assert.equal(rows.find(r => r.id === 'itransform-event').calendar_scope, 'itransform');
  assert.equal(rows.length, 2);
  assert.equal(audits.length, 0);
});

test('MyGrowise create, update and delete remain available and audited', async () => {
  const { service, rows, audits } = setup();
  const created = await service.createPracticeAgendaEvent(input, actor);
  assert.equal(rows.find(r => r.id === created.id).calendar_scope, 'mygrowise');
  await service.updatePracticeAgendaEvent(created.id, { ...input, title: 'Aangepast' }, actor);
  assert.equal(rows.find(r => r.id === created.id).title, 'Aangepast');
  await service.deletePracticeAgendaEvent(created.id, actor);
  assert.equal(rows.length, 2);
  assert.equal(audits.length, 3);
});

const routeSetup = () => {
  const calls = [];
  const route = load('../src/pages/api/admin/agenda.ts', {
    '../../../lib/adminAgenda': {
      createPracticeAgendaEvent: async value => { calls.push(value); return { id: person }; },
      updatePracticeAgendaEvent: async (id, value) => { calls.push(value); return { id }; },
    },
    '../../../lib/adminAuth': { isTrustedFormOrigin: () => true },
    '../../../lib/securityAudit': { auditActor: () => actor },
  });
  return { route, calls };
};

test('admin API defaults omitted scope to MyGrowise and rejects other scopes', async () => {
  for (const method of ['POST', 'PATCH']) {
    const { route, calls } = routeSetup();
    const context = body => ({ request: { json: async () => body }, locals: {}, url: new URL(`https://example.invalid/api/admin/agenda?id=${person}`) });
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

const { default: Agenda, AgendaEventCard, ImportedAgendaDetails } = load('../src/components/admin/UnifiedAgenda.tsx', {
  '@fullcalendar/react': { __esModule: true, default: () => null },
  ...Object.fromEntries(['daygrid', 'timegrid', 'interaction', 'list', 'luxon3'].map(name => [`@fullcalendar/${name}`, {}])),
  '@fullcalendar/core/locales/nl': {},
  '../../lib/brusselsTime': {},
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
  const events = await practiceService.listPracticeAgenda(person, '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', true);
  assert.equal(events.find(e => e.id === 'external-event').editable, false);
  assert.match(events.find(e => e.id === 'external-event').subtitle, /MijnDiAd/);
  assert.ok(!events.some(e => e.id === 'someone-elses-event'));
  const withoutAccess = await practiceService.listPracticeAgenda(person, '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', false);
  assert.ok(!withoutAccess.some(e => e.source === 'itransform'));
  const adminEvents = await service.listAgendaEvents('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z');
  assert.ok(!adminEvents.some(e => e.id === 'external-event'));
});

test('practice service rejects imported event edits/deletes and cross-owner Itransform writes', async () => {
  const { practiceService, rows, audits } = setup();
  rows.push({ ...row('external-event', 'itransform'), external_source: 'mijndiad' });
  rows.push({ ...row('someone-elses-event', 'itransform'), practitioner_id: 'someone-else' });
  for (const id of ['external-event', 'someone-elses-event']) {
    await assert.rejects(practiceService.updateOwnedAgendaEvent(person, id, { ...input, calendarScope: 'itransform' }, actor, true), /not_found/);
    await assert.rejects(practiceService.deleteOwnedAgendaEvent(person, id, actor, true), /not_found/);
  }
  assert.equal(audits.length, 0);
  await practiceService.updateOwnedAgendaEvent(person, 'itransform-event', { ...input, calendarScope: 'itransform' }, actor, true);
  assert.equal(audits.length, 1);
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
