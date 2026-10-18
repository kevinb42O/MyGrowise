import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMijndiadCalendar, mijndiadAppointmentUrl } from '../scripts/lib/mijndiad-ical.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const event = (uid, start, end, extra = '') => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;TZID=Europe/Amsterdam:${start}\r\nDTEND;TZID=Europe/Amsterdam:${end}\r\nSUMMARY:Bezet - EMDR\r\nDESCRIPTION:Private notes\r\nURL:https://praktijkitransform.mijndiad.nl/appointments/123\r\nLOCATION:Brugge - Praktijk\r\n${extra}END:VEVENT\r\n`;
const calendar = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('')}END:VCALENDAR\r\n`;

test('preserves winter/summer instants and published details without importing descriptions', () => {
  const rows = parseMijndiadCalendar(calendar(event('winter', '20261120T100000', '20261120T110000'), event('summer', '20270620T100000', '20270620T110000')), owner);
  assert.equal(rows[0].startsAt, '2026-11-20T09:00:00.000Z');
  assert.equal(rows[1].startsAt, '2027-06-20T08:00:00.000Z');
  assert.equal(rows[0].externalUid.length, 64);
  assert.equal(rows[0].title, 'EMDR');
  assert.equal(rows[0].location, 'Brugge - Praktijk');
  assert.equal(rows[0].kind, 'appointment');
  assert.equal(rows[0].externalUrl, 'https://praktijkitransform.mijndiad.nl/appointments/123');
  assert.doesNotMatch(JSON.stringify(rows), /Private|example|secret|winter|summer/);
});

test('stable UID survives rescheduling; ownership namespaces the local ID', () => {
  const first = parseMijndiadCalendar(calendar(event('same-uid', '20261120T100000', '20261120T110000')), owner)[0];
  const moved = parseMijndiadCalendar(calendar(event('same-uid', '20261121T100000', '20261121T110000')), owner)[0];
  const other = parseMijndiadCalendar(calendar(event('same-uid', '20261120T100000', '20261120T110000')), 'another-owner')[0];
  assert.equal(first.id, moved.id); assert.equal(first.externalUid, moved.externalUid);
  assert.notEqual(first.startsAt, moved.startsAt); assert.notEqual(first.id, other.id);
});

test('cancelled and transparent events do not reserve availability', () => {
  const rows = parseMijndiadCalendar(calendar(event('cancelled', '20261120T100000', '20261120T110000', 'STATUS:CANCELLED\r\n'), event('free', '20261120T100000', '20261120T110000', 'TRANSP:TRANSPARENT\r\n')), owner);
  assert.ok(rows.every(e => e.status === 'cancelled'));
});

test('rejects incomplete calendars, empty responses and duplicate UIDs atomically', () => {
  const one = event('one', '20261120T100000', '20261120T110000');
  for (const bad of ['<html>Login</html>', calendar(), calendar(one).replace('END:VCALENDAR', ''), calendar(one, one), calendar(one.replace('UID:one\r\n', ''))]) {
    assert.throws(() => parseMijndiadCalendar(bad, owner), /nothing imported/);
  }
});

test('rejects unexpanded recurrence, unsupported dates and invalid DST wall times', () => {
  for (const bad of [event('one', '20261120T100000', '20261120T090000'), event('one', '20260329T023000', '20260329T033000'), event('one', '20261025T023000', '20261025T033000'), event('one', '20261120T100000', '20261120T110000', 'RRULE:FREQ=WEEKLY\r\n'), event('one', '20261120', '20261121')]) {
    assert.throws(() => parseMijndiadCalendar(calendar(bad), owner), /nothing imported/);
  }
});

test('supports UTC events and folded properties', () => {
  const ics = calendar(event('one\r\n -folded', '20261120T100000Z', '20261120T110000Z')).replaceAll(';TZID=Europe/Amsterdam', '');
  assert.equal(parseMijndiadCalendar(ics, owner)[0].startsAt, '2026-11-20T10:00:00.000Z');
});

test('distinguishes private and online appointments without changing occupancy', () => {
  const privateEvent = event('private', '20261120T100000', '20261120T110000').replace('Bezet - EMDR', 'Bezet - Privé');
  const onlineEvent = event('online', '20261120T110000', '20261120T120000').replace('LOCATION:Brugge - Praktijk', 'LOCATION:Online');
  const rows = parseMijndiadCalendar(calendar(privateEvent, onlineEvent), owner);
  assert.equal(rows[0].kind, 'personal'); assert.equal(rows[0].status, 'confirmed');
  assert.equal(rows[1].kind, 'appointment'); assert.equal(rows[1].status, 'confirmed');
  assert.notEqual(rows[0].color, rows[1].color);
  const intervision = parseMijndiadCalendar(calendar(privateEvent.replace('Bezet - Privé', 'Bezet - Intervisie therapie')), owner)[0];
  assert.equal(intervision.kind, 'personal');
});

test('only allows actual MijnDiAd appointment links; rejects login tokens and external URLs', () => {
  for (const bad of ['javascript:alert(1)', 'https://example.invalid/appointments/123', 'https://praktijkitransform.mijndiad.nl.evil.invalid/appointments/123', 'https://praktijkitransform.mijndiad.nl/appointments/123?token=secret', 'https://user:pass@praktijkitransform.mijndiad.nl/appointments/123']) {
    assert.equal(mijndiadAppointmentUrl(bad), null);
  }
});
