import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingMailContent } from '../src/lib/bookingMailContent.ts';
import { bookingOutcomeLabel } from '../src/lib/bookingOutcome.ts';

const appointment = { name: 'Testcliënt', appointment: 'Vervolggesprek', practitioner: 'Testbegeleider', startsAt: '2026-11-25T09:00:00Z', endsAt: '2026-11-25T10:00:00Z', channel: 'online' };
test('online confirmation and reminder explain the manually sent Meet link in text and HTML', () => {
  for (const kind of ['confirmation', 'reminder', 'rescheduled']) {
    const mail = bookingMailContent(kind, appointment);
    assert.match(mail.text, /Vijf minuten vóór uw afspraak ontvangt u via e-mail een link naar Google Meet/);
    assert.match(mail.html, /Google Meet/);
    assert.match(mail.text, /10:00/);
  }
  const reminder = bookingMailContent('reminder', appointment);
  assert.match(reminder.subject, /Herinnering afspraak/);
  assert.match(reminder.text, /Over drie dagen/);
});
test('cancelled and in-person appointments do not promise a Meet link', () => {
  for (const mail of [bookingMailContent('cancelled', appointment), bookingMailContent('confirmation', { ...appointment, channel: 'practice', location: 'Praktijk' })]) {
    assert.doesNotMatch(mail.text, /Google Meet/);
    assert.doesNotMatch(mail.html, /Google Meet/);
  }
});
test('administrative outcomes preserve unknown historical classifications', () => {
  assert.equal(bookingOutcomeLabel({ status: 'cancelled' }), 'Geannuleerd');
  assert.equal(bookingOutcomeLabel({ status: 'cancelled', cancellationCategory: 'timely' }), 'Tijdig geannuleerd');
  assert.equal(bookingOutcomeLabel({ status: 'cancelled', cancellationCategory: 'late' }), 'Laattijdig geannuleerd');
  assert.equal(bookingOutcomeLabel({ status: 'no_show' }), 'No-show — facturatie te beoordelen');
  assert.equal(bookingOutcomeLabel({ status: 'no_show', noShowBilling: 'invoiced' }), 'No-show — gefactureerd');
  assert.equal(bookingOutcomeLabel({ status: 'no_show', noShowBilling: 'not_invoiced' }), 'No-show — niet gefactureerd');
});
