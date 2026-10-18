// One-off snapshot import. Default rehearses in a transaction and rolls back.
// Set MIJNDIAD_ICAL_URL in the ignored .env; never put the private link in Git.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchMijndiadCalendar } from './lib/mijndiad-ical.mjs';

const apply = process.argv.includes('--apply');
const migrations = ['20261018190320_mijndiad_agenda_import.sql', '20261018191149_mijndiad_agenda_details.sql'];
if (!process.env.MIJNDIAD_ICAL_URL || !process.env.SUPABASE_DB_URL) {
  throw new Error('MIJNDIAD_ICAL_URL and SUPABASE_DB_URL must be configured.');
}
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, connectionTimeoutMillis: 10_000 });
try {
  await db.connect();
  const identity = await db.query("select id,user_id from public.practitioners where slug='virginie' and active and user_id is not null");
  assert.equal(identity.rowCount, 1, 'Expected exactly one active, account-linked Virginie.');
  const practitioner = identity.rows[0];
  const events = await fetchMijndiadCalendar(process.env.MIJNDIAD_ICAL_URL, practitioner.id);
  const payload = JSON.stringify(events);
  const dates = events.map(e => e.startsAt).sort();
  console.log(JSON.stringify({ feedEvents: events.length, firstStart: dates[0], lastStart: dates.at(-1), mode: apply ? 'apply' : 'rehearsal' }));
  await db.query('begin');
  await db.query("set local lock_timeout='10s'; set local statement_timeout='60s'");
  await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [practitioner.id]);
  for (const migration of migrations) {
    const [version, ...name] = migration.replace('.sql', '').split('_');
    const registered = await db.query('select 1 from supabase_migrations.schema_migrations where version=$1', [version]);
    if (!registered.rowCount) {
      const sql = readFileSync(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8');
      await db.query(sql);
      await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])', [version, name.join('_'), [sql]]);
    }
  }
  const before = (await db.query("select count(*)::int n from public.practice_calendar_events where external_source is null")).rows[0].n;
  await db.query("set local mygrowise.mijndiad_import='on'");
  const write = await db.query(`
    insert into public.practice_calendar_events
      (id,practitioner_id,calendar_scope,title,starts_at,ends_at,status,event_kind,location,color,external_source,external_uid,external_url)
    select x.id::uuid,$1,'itransform',x.title,x."startsAt"::timestamptz,x."endsAt"::timestamptz,x.status,x.kind,x.location,x.color,'mijndiad',x."externalUid",x."externalUrl"
    from jsonb_to_recordset($2::jsonb) x(id text,"startsAt" text,"endsAt" text,status text,"externalUid" text,title text,kind text,location text,color text,"externalUrl" text)
    on conflict (practitioner_id,external_source,external_uid) where external_source is not null do update
      set starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,title=excluded.title,
        event_kind=excluded.event_kind,location=excluded.location,color=excluded.color,external_url=excluded.external_url
      where (practice_calendar_events.starts_at,practice_calendar_events.ends_at,practice_calendar_events.status,
        practice_calendar_events.title,practice_calendar_events.event_kind,practice_calendar_events.location,practice_calendar_events.color,practice_calendar_events.external_url)
        is distinct from (excluded.starts_at,excluded.ends_at,excluded.status,excluded.title,excluded.event_kind,excluded.location,excluded.color,excluded.external_url)
    returning id`, [practitioner.id, payload]);
  await db.query("set local mygrowise.mijndiad_import='off'");
  const matched = (await db.query(`select count(*)::int n
    from jsonb_to_recordset($2::jsonb) x(id text,"startsAt" text,"endsAt" text,status text,"externalUid" text,title text,kind text,location text,color text,"externalUrl" text)
    join public.practice_calendar_events e on e.practitioner_id=$1 and e.external_source='mijndiad' and e.external_uid=x."externalUid"
    where e.starts_at=x."startsAt"::timestamptz and e.ends_at=x."endsAt"::timestamptz and e.status=x.status
      and e.calendar_scope='itransform' and e.title=x.title and e.event_kind=x.kind and e.location=x.location
      and e.color=x.color and e.external_url is not distinct from x."externalUrl"`, [practitioner.id, payload])).rows[0].n;
  assert.equal(matched, events.length, 'Every feed appointment must match its stored block.');
  assert.equal((await db.query('select count(*)::int n from public.practice_calendar_events where external_source is null')).rows[0].n, before);
  const overlap = (await db.query(`select count(*)::int n from public.practice_calendar_events e join public.bookings b
    on b.practitioner_id=e.practitioner_id and b.status in ('pending','confirmed')
      and b.time_range && tstzrange(e.starts_at,e.ends_at,'[)')
    where e.practitioner_id=$1 and e.external_source='mijndiad' and e.status='confirmed'`, [practitioner.id])).rows[0].n;
  const blocked = (await db.query(`select count(*)::int n from public.get_bookable_slots('virginie',90) s
    join public.practice_calendar_events e on e.practitioner_id=s.practitioner_id and e.external_source='mijndiad'
      and e.status='confirmed' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)')`)).rows[0].n;
  assert.equal(blocked, 0, 'Imported busy blocks must not be bookable.');
  const offerOverlap = (await db.query(`select count(*)::int n from public.practitioner_appointment_types o
    cross join lateral public.get_offer_slots(o.id,90) s
    join public.practice_calendar_events e on e.practitioner_id=s.practitioner_id and e.external_source='mijndiad'
      and e.status='confirmed' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)')
    where o.practitioner_id=$1`, [practitioner.id])).rows[0].n;
  assert.equal(offerOverlap, 0, 'Appointment-type availability must also respect the import.');
  // Verify read-only protection for the actual application role, even with a forged flag.
  for (const statement of ["update public.practice_calendar_events set title='Should fail' where id=$1",
    'delete from public.practice_calendar_events where id=$1']) {
    await db.query('savepoint readonly_check');
    await db.query('set local role service_role');
    await db.query("set local mygrowise.mijndiad_import='on'");
    let denied = false;
    try { await db.query(statement, [events[0].id]); } catch (error) { denied = error.code === '42501'; }
    await db.query('rollback to savepoint readonly_check');
    assert.ok(denied, 'The application must not modify imported blocks.');
  }
  await db.query('savepoint overlap_check');
  await db.query('set local role service_role');
  let bookingBlocked = false;
  const occupied = events.find(e => e.status === 'confirmed');
  assert.ok(occupied, 'Expected at least one busy appointment.');
  try {
    await db.query(`insert into public.practice_calendar_events(practitioner_id,calendar_scope,title,starts_at,ends_at)
      values($1,'mygrowise','Overlap check',$2,$3)`, [practitioner.id, occupied.startsAt, occupied.endsAt]);
  } catch (error) { bookingBlocked = error.code === '23P01'; }
  await db.query('rollback to savepoint overlap_check');
  assert.ok(bookingBlocked, 'New local events must not overlap imported appointments.');
  if (write.rowCount) {
    await db.query(`insert into public.security_audit_log(action,object_type,object_id,metadata)
      values('practice_calendar.mijndiad_imported','practitioner',$1,$2::jsonb)`,
    [practitioner.id, JSON.stringify({ source: 'mijndiad', feed_events: events.length, written: write.rowCount, booking_overlaps: overlap, method: 'operator_snapshot_import' })]);
  }
  await db.query(apply ? 'commit' : 'rollback');
  console.log(JSON.stringify({ committed: apply, matched, written: write.rowCount, existingBookingsOverlapping: overlap,
    existingLocalEventsPreserved: before, bookableOverlaps: blocked + offerOverlap, readOnlyVerified: true, automaticSync: false }));
} catch (error) {
  await db.query('rollback').catch(() => {});
  // Avoid logging feed URLs, connection strings or SQL parameter values.
  console.error('Import failed; transaction rolled back:', error.code || error.message);
  process.exitCode = 1;
} finally { await db.end(); }
