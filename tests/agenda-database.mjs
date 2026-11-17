// Run on a migrated disposable database with AGENDA_TEST_DB_URL set.
// All synthetic test data is rolled back, including the Vault fixture.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function exerciseAgendaDatabase(query) {
  const users = { admin: randomUUID(), therapist: randomUUID(), other: randomUUID() };
  const owner = randomUUID(), otherOwner = randomUUID();
  const from = new Date(Date.now() + 3 * 86400000).toISOString();
  const to = new Date(Date.parse(from) + 3600000).toISOString();
  const q = (sql, values = []) => query(sql, values);
  const expectFailure = async (work, code) => {
    await q('savepoint agenda_expected_failure');
    try { await assert.rejects(work, error => error.code === code); }
    finally { await q('rollback to savepoint agenda_expected_failure'); }
  };

  await q('begin');
  try {
    for (const [name, id] of Object.entries(users)) {
      await q("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),'{\"full_name\":\"Synthetic therapist\"}')", [id, `${id}@example.invalid`]);
      await q('delete from public.user_roles where user_id=$1', [id]);
      await q('insert into public.user_roles(user_id,role) values($1,$2)', [id, name === 'admin' ? 'super_admin' : 'practitioner']);
    }
    await q('insert into public.practitioners(id,user_id,slug,name,active) values($1,$2,$3,$3,true),($4,$5,$6,$6,true)',
      [owner, users.therapist, `synthetic-${owner}`, otherOwner, users.other, `synthetic-${otherOwner}`]);
    await q('insert into public.practitioner_settings(practitioner_id,minimum_notice_hours,booking_horizon_days) values($1,0,30)', [owner]);
    for (let day = 1; day <= 7; day++) await q("insert into public.availability_rules(practitioner_id,weekday,start_time,end_time) values($1,$2,'09:00','18:00')", [owner, day]);

    const mutate = async (actor, mode, operation, practitioner, id, revision, values) =>
      (await q("select public.mutate_agenda_item($1,$2,$3,$4,$5,$6,$7,null,'/test/agenda') item",
        [actor, mode, operation, practitioner, id, revision, JSON.stringify(values || {})])).rows[0].item;
    const event = { title: 'Testmoment', location: '', color: '#d97706', event_kind: 'personal', calendar_scope: 'mygrowise', starts_at: from, ends_at: to };
    const created = await mutate(users.therapist, 'practice', 'create', owner, null, null, event);
    const moved = await mutate(users.admin, 'admin', 'move', null, created.id, created.updated_at, { starts_at: from, ends_at: to });
    assert.equal(moved.title, created.title);
    assert.notEqual(moved.updated_at, created.updated_at);
    await expectFailure(() => mutate(users.therapist, 'practice', 'delete', owner, created.id, created.updated_at), '40001');

    const reassigned = await mutate(users.admin, 'admin', 'update', otherOwner, created.id, moved.updated_at, event);
    await expectFailure(() => mutate(users.therapist, 'practice', 'delete', owner, created.id, reassigned.updated_at), 'P0002');
    await mutate(users.admin, 'admin', 'delete', null, created.id, reassigned.updated_at);
    await q("create function pg_temp.reject_agenda_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$");
    await q("create trigger agenda_test_audit_failure before insert on public.security_audit_log for each row when (new.after_snapshot->>'title'='Rollback test') execute function pg_temp.reject_agenda_audit()");
    await expectFailure(() => mutate(users.therapist, 'practice', 'create', owner, null, null, { ...event, title:'Rollback test' }), 'P0001');
    assert.equal((await q("select id from public.practice_calendar_events where title='Rollback test'")).rows.length,0);
    assert.equal(Number((await q('select count(*) from public.security_audit_log where object_id=$1', [created.id])).rows[0].count), 4);

    const block = await mutate(users.therapist, 'practice', 'block', owner, null, null, { starts_at: from, ends_at: to, private_reason: 'Privé' });
    const occupancy = (await q('select * from public.agenda_private_occupancy($1,$2,$3)', [from, to, owner])).rows;
    assert.equal(occupancy.length, 1);
    assert.notEqual(occupancy[0].id, block.id);
    assert.equal(Object.hasOwn(occupancy[0], 'private_reason'), false);
    await expectFailure(() => mutate(users.therapist, 'practice', 'create', owner, null, null, event), '23P01');
    await mutate(users.therapist, 'practice', 'unblock', owner, block.id);

    const type = (await q("select id from public.appointment_types where slug='intake-emdr-online'")).rows[0].id;
    const offer = (await q('insert into public.practitioner_appointment_types(practitioner_id,appointment_type_id,duration_minutes) values($1,$2,75) returning id', [owner, type])).rows[0].id;
    const slots = (await q('select * from public.get_offer_slots($1,4)', [offer])).rows;
    const slot = slots[0];
    assert.equal(+new Date(slot.ends_at) - +new Date(slot.starts_at), 75 * 60000);
    const shade = (await q('select * from public.agenda_offer_availability($1,$2,$3)', [owner, slot.starts_at, slot.ends_at])).rows;
    assert.ok(shade.some(row => row.offer_id === offer && row.slots.some(([start, end]) =>
      +new Date(start) === +new Date(slot.starts_at) && +new Date(end) === +new Date(slot.ends_at))));

    const booking = (await q("insert into public.bookings(practitioner_id,client_name,client_email,starts_at,ends_at,status) values($1,'Synthetic client','patient@example.invalid',$2,$3,'confirmed') returning id,updated_at",
      [owner, slot.starts_at, slot.ends_at])).rows[0];
    const newTime = new Date(+new Date(slot.starts_at) + 86400000).toISOString();
    const exactRevision = (await q('select updated_at::text from public.bookings where id=$1',[booking.id])).rows[0].updated_at;
    await q('select public.agenda_staff_booking_change($1,$2,$3,$4,null,$5,null,null)', [users.therapist, booking.id, owner, exactRevision, newTime]);
    const afterMove = (await q('select kind,status from public.booking_mail_jobs where booking_id=$1', [booking.id])).rows;
    assert.ok(afterMove.some(row => row.kind === 'confirmation' && row.status === 'superseded'));
    const oldMail = (await q('select * from public.claim_booking_mail(4,$1)', [booking.id])).rows;
    assert.deepEqual(oldMail.map(row => row.kind), ['rescheduled']);
    assert.equal(+new Date(oldMail[0].payload.startsAt),+new Date(newTime));
    const exactNewRevision = (await q('select updated_at::text from public.bookings where id=$1',[booking.id])).rows[0].updated_at;
    await q("select public.agenda_staff_booking_change($1,$2,$3,$4,'cancelled',null,null,null)", [users.therapist, booking.id, owner, exactNewRevision]);
    assert.equal((await q('select * from public.claim_booking_mail(4,$1)', [booking.id])).rows.length, 0);
    assert.equal((await q('select public.booking_mail_is_current($1) current', [oldMail[0].id])).rows[0].current, false);
    await q("update public.booking_mail_jobs set status='superseded', lease_until=null where id=$1", [oldMail[0].id]);
    assert.deepEqual((await q('select * from public.claim_booking_mail(4,$1)', [booking.id])).rows.map(row => row.kind), ['cancelled']);

    const calendar = events => ['BEGIN:VCALENDAR','VERSION:2.0',...events.flatMap(lines=>['BEGIN:VEVENT',...lines,'END:VEVENT']),'END:VCALENDAR',''].join('\r\n');
    const parse = async events => (await q('select practice_private.parse_mijndiad_calendar($1,$2) entries',[calendar(events),owner])).rows[0].entries;
    assert.equal((await parse([])).length,0);
    const monday = new Date(Date.now() + (8 - new Date().getUTCDay()) % 7 * 86400000);
    const occurrenceDate = weeks => new Date(+monday + weeks * 7 * 86400000).toISOString().slice(0,10).replaceAll('-','');
    const imported = await parse([
      ['UID:all-day','DTSTART;VALUE=DATE:20261025','SUMMARY:Verlof'],
      ['UID:series',`DTSTART;TZID=Europe/Brussels:${occurrenceDate(0)}T090000`,'DURATION:PT30M',
        'RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=MO',`EXDATE;TZID=Europe/Brussels:${occurrenceDate(1)}T090000`,'SUMMARY:Consult'],
      ['UID:series',`RECURRENCE-ID;TZID=Europe/Brussels:${occurrenceDate(2)}T090000`,`DTSTART;TZID=Europe/Brussels:${occurrenceDate(2)}T110000`,'DURATION:PT30M','SUMMARY:Verplaatst',
        'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-PT15M','END:VALARM'],
    ]);
    const allDay = imported.find(row=>row.title==='Verlof');
    assert.equal(Date.parse(allDay.endsAt)-Date.parse(allDay.startsAt),25*3600000);
    assert.equal(imported.length,4);
    const movedOccurrence = imported.find(row=>row.title==='Verplaatst');
    assert.equal(new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit'}).format(new Date(movedOccurrence.startsAt)),'11:00');
    await expectFailure(() => parse([['UID:complex',`DTSTART:${occurrenceDate(0)}T090000Z`,'DURATION:PT30M',
      'RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2']]), 'P0001');

    const secret = (await q("select vault.create_secret('synthetic calendar secret') id")).rows[0].id;
    await q('insert into practice_private.mijndiad_sync(practitioner_id,feed_secret_id,enabled,last_success_at,coverage_until) values($1,$2,true,now(),$3)', [owner, secret, slot.ends_at]);
    const covered = (await q('select * from public.get_offer_slots($1,4)', [offer])).rows;
    assert.ok(covered.length>0 && covered.every(candidate => +new Date(candidate.ends_at) <= +new Date(slot.ends_at)));
    await expectFailure(() => q("insert into public.bookings(practitioner_id,client_name,client_email,starts_at,ends_at,status) values($1,'Other synthetic client','other@example.invalid',$2,$3,'confirmed')",[owner,from,to]),'55000');

    // Coverage follows the provider's documented window, including empty feeds.
    // A distant appointment, or a generated recurrence, cannot move that window.
    const applySnapshot = events => q('select practice_private.apply_mijndiad_snapshot($1,$2::jsonb)', [owner,JSON.stringify(events)]);
    const future = {
      id:randomUUID(),externalUid:'a'.repeat(64),title:'Synthetic coverage test',
      startsAt:new Date(Date.now()+70*86400000).toISOString(),
      endsAt:new Date(Date.now()+70*86400000+1800000).toISOString(),
      status:'confirmed',kind:'block',location:'',color:'#687985',externalUrl:null,coverageEdge:false,
    };
    const distant = {...future,id:randomUUID(),externalUid:'b'.repeat(64),
      startsAt:new Date(Date.now()+800*86400000).toISOString(),endsAt:new Date(Date.now()+800*86400000+1800000).toISOString()};
    await applySnapshot([future,distant]);
    const sync = (await q('select practice_private.mijndiad_sync_status($1) state',[owner])).rows[0].state;
    assert.ok(Date.parse(sync.coverageUntil)>Date.now()+360*86400000);
    assert.ok(Date.parse(sync.coverageUntil)<Date.now()+367*86400000);
    assert.ok(Date.parse(sync.coverageFrom)<Date.now());
    const coverageEnd=sync.coverageUntil;
    await applySnapshot([]);
    assert.equal((await q('select status from public.practice_calendar_events where id=$1',[future.id])).rows[0].status,'confirmed');
    assert.equal((await q('select practice_private.mijndiad_sync_status($1) state',[owner])).rows[0].state.pendingMissing,1);
    await applySnapshot([]);
    assert.equal((await q('select status from public.practice_calendar_events where id=$1',[future.id])).rows[0].status,'cancelled');
    assert.equal((await q('select status from public.practice_calendar_events where id=$1',[distant.id])).rows[0].status,'confirmed');
    const emptySync=(await q('select practice_private.mijndiad_sync_status($1) state',[owner])).rows[0].state;
    assert.equal(emptySync.coverageUntil,coverageEnd);
    assert.equal(emptySync.eventCount,0);
    assert.equal(emptySync.coverageUncertain,1);
    // A historical missing record must not leave a permanent sync warning.
    const historical={...future,id:randomUUID(),externalUid:'c'.repeat(64),
      startsAt:new Date(Date.now()-7200000).toISOString(),endsAt:new Date(Date.now()-3600000).toISOString()};
    await applySnapshot([historical]);
    await q("select set_config('mygrowise.mijndiad_import','on',true)");
    await q('update public.practice_calendar_events set external_missing_count=1 where id=$1',[historical.id]);
    await q("select set_config('mygrowise.mijndiad_import','off',true)");
    assert.equal((await q('select practice_private.mijndiad_sync_status($1) state',[owner])).rows[0].state.pendingMissing,0);
    assert.equal((await q('select practice_private.mijndiad_covers($1,$2) covered',[owner,new Date(Date.now()+300*86400000)])).rows[0].covered,true);
    assert.equal((await q('select practice_private.mijndiad_covers($1,$2) covered',[owner,new Date(Date.now()+400*86400000)])).rows[0].covered,false);
  } finally {
    await q('rollback');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { default: pg } = await import('pg');
  if (!process.env.AGENDA_TEST_DB_URL) throw new Error('Set AGENDA_TEST_DB_URL to your migrated test database.');
  const client = new pg.Client({connectionString:process.env.AGENDA_TEST_DB_URL,connectionTimeoutMillis:10000});
  await client.connect();
  try {
    await exerciseAgendaDatabase((sql, values) => client.query(sql, values));
    console.log('Agenda database regression passed.');
  } finally { await client.end(); }
}
