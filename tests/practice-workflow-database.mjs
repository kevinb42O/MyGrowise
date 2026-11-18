// Rehearse this migration and synthetic workflows in ONE rollback-only transaction.
// No mail transport or committed changes; requires the existing migrated schema.
import pg from 'pg';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const url = process.env.PRACTICE_TEST_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) throw new Error('Set PRACTICE_TEST_DB_URL (or SUPABASE_DB_URL for rollback-only rehearsal).');
const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
await c.connect();
const q = (sql, values = []) => c.query(sql, values);
let checks = 0;
const check = (fn) => { fn(); checks++; };
const rejects = async (fn, pattern) => {
  await q('savepoint expected_failure');
  try { await assert.rejects(fn, e => pattern.test(e.message)); checks++; }
  finally { await q('rollback to savepoint expected_failure'); }
};
try {
  await q('begin');
  await q("set local lock_timeout='3s'; set local statement_timeout='20s'");
  const applied = await q("select 1 from supabase_migrations.schema_migrations where version='20261117170000'");
  if (!applied.rowCount) await q(fs.readFileSync('supabase/migrations/20261117170000_practice_workflow_fixes.sql', 'utf8'));
  await q(fs.readFileSync('supabase/migrations/20261118100000_preserve_future_booking_reminders.sql', 'utf8'));
  const admin = randomUUID(), therapist = randomUUID(), other = randomUUID(), customer = randomUUID(), owner = randomUUID();
  for (const [id, role] of [[admin, 'super_admin'], [therapist, 'practitioner'], [other, 'practitioner'], [customer, 'customer']]) {
    await q("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),'{\"full_name\":\"Synthetic workflow test\"}')", [id, `${id}@example.invalid`]);
    await q('delete from public.user_roles where user_id=$1', [id]);
    await q('insert into public.user_roles(user_id,role) values($1,$2)', [id, role]);
  }
  await q("insert into public.practitioners(id,user_id,slug,name,active) values($1,$2,$3,'Synthetic workflow therapist',true)", [owner, therapist, `workflow-${owner}`]);
  await q('insert into public.practitioner_settings(practitioner_id,minimum_notice_hours,booking_horizon_days) values($1,0,90)', [owner]);
  for (let day = 1; day <= 7; day++) await q("insert into public.availability_rules(practitioner_id,weekday,start_time,end_time) values($1,$2,'08:00','18:00')", [owner, day]);
  const type = (await q("select id from public.appointment_types where slug='intake-emdr-online'")).rows[0].id;
  const offer = (await q('insert into public.practitioner_appointment_types(practitioner_id,appointment_type_id,duration_minutes) values($1,$2,60) returning id', [owner, type])).rows[0].id;
  const start = (await q("select (((now() at time zone 'Europe/Brussels')::date+10)+time '10:00') at time zone 'Europe/Brussels' t")).rows[0].t.toISOString();
  await q('set local role service_role');
  const key = randomUUID(), email = `${customer}@example.invalid`;
  const create = (name = `Zoë Van Workflow ${key}`, mail = email, time = start, k = key) => q("select public.book_new_patient($1,$2,$3,$4,$5,$6,date '1990-05-12',null) id", [therapist, k, name, mail, offer, time]);
  const id = (await create()).rows[0].id;
  assert.equal((await create()).rows[0].id, id); checks++;
  await rejects(() => create('Changed name'), /idempotency_conflict/);
  const load = async () => (await q('select *,updated_at::text as updated_at from public.bookings where id=$1', [id])).rows[0];
  let booking = await load();
  check(() => { assert.equal(booking.status, 'confirmed'); assert.equal(booking.customer_user_id, null); assert.ok(booking.patient_id); });
  const initialJobs = (await q('select * from public.booking_mail_jobs where booking_id=$1 order by created_at', [id])).rows;
  check(() => assert.deepEqual(initialJobs.map(j => j.kind).sort(), ['confirmation', 'reminder']));
  const reminder = initialJobs.find(j => j.kind === 'reminder');
  const due = (await q("select starts_at-interval '72 hours' due from public.bookings where id=$1", [id])).rows[0].due;
  check(() => assert.equal(+reminder.scheduled_for, +due));
  check(() => assert.equal((reminder.payload.name).startsWith('Zoë'), true));
  // A normal confirmation claim must preserve its future reminder. No SMTP.
  assert.equal((await q('select public.booking_mail_is_relevant($1) ok',[reminder.id])).rows[0].ok,true);checks++;
  assert.equal((await q('select public.booking_mail_is_current($1) ok',[reminder.id])).rows[0].ok,false);checks++;
  const claimed=(await q('select * from public.claim_booking_mail(1,$1)',[id])).rows;
  assert.deepEqual(claimed.map(j=>j.kind),['confirmation']);checks++;
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[reminder.id])).rows[0].status,'pending');checks++;
  await q("update public.booking_mail_jobs set status='sent',sent_at=now(),lease_until=null where id=$1",[claimed[0].id]);
  // Roll back global claim mutations, including any real pending work.
  await q('savepoint global_claim');
  await q('select * from public.claim_booking_mail(1,null)');
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[reminder.id])).rows[0].status,'pending');checks++;
  await q('rollback to savepoint global_claim');
  await q('savepoint reminder_deadline');
  await q("update public.booking_mail_jobs set scheduled_for=now(),next_attempt_at=now() where id=$1",[reminder.id]);
  const ready=(await q('select * from public.claim_booking_mail(1,$1)',[id])).rows;
  assert.deepEqual(ready.map(j=>j.id),[reminder.id]);checks++;
  assert.equal((await q('select * from public.claim_booking_mail(1,$1)',[id])).rowCount,0);checks++;
  await q('rollback to savepoint reminder_deadline');
  // Recovery must restore exact, never-attempted future reminders only.
  const fixSql=fs.readFileSync('supabase/migrations/20261118100000_preserve_future_booking_reminders.sql','utf8');
  const recovery=fixSql.slice(fixSql.indexOf('-- Restore only'),fixSql.indexOf('-- Bound'));
  await q('savepoint reminder_recovery');
  await q("update public.booking_mail_jobs set status='superseded',attempts=1 where id=$1",[reminder.id]);
  await q(recovery);
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[reminder.id])).rows[0].status,'superseded');checks++;
  await q("update public.booking_mail_jobs set status='suppressed',attempts=0 where id=$1",[reminder.id]);
  await q(recovery);
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[reminder.id])).rows[0].status,'suppressed');checks++;
  await q("update public.booking_mail_jobs set status='superseded',payload=jsonb_set(payload,'{startsAt}',to_jsonb(now())) where id=$1",[reminder.id]);
  await q(recovery);
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[reminder.id])).rows[0].status,'superseded');checks++;
  await q('rollback to savepoint reminder_recovery');
  await q("update public.booking_mail_jobs set status='superseded' where id=$1",[reminder.id]);
  await q(recovery);
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[reminder.id])).rows[0].status,'pending');checks++;
  await rejects(() => create(`Another ${randomUUID()}`, email, start, randomUUID()), /potential_patient_match/);
  const patientsBefore = Number((await q('select count(*) from public.patients')).rows[0].count);
  await rejects(() => create(`Conflict ${randomUUID()}`, `${randomUUID()}@example.invalid`, start, randomUUID()), /slot_unavailable|conflict|exclusion/i);
  assert.equal(Number((await q('select count(*) from public.patients')).rows[0].count), patientsBefore); checks++;
  await q('select public.link_patient_customer_account($1,$2,$3,null)', [admin, booking.patient_id, customer]);
  booking = await load();
  check(() => assert.equal(booking.customer_user_id, customer));
  assert.equal(Number((await q('select count(*) from public.booking_mail_jobs where booking_id=$1', [id])).rows[0].count), 2); checks++;
  const results = (await q("select * from public.agenda_client_choices($1,'zoe van',0,10)", [therapist])).rows;
  check(() => assert.ok(results.some(r => r.id === booking.patient_id)));
  assert.equal((await q("select * from public.agenda_client_choices($1,'Workflow',0,10)", [other])).rowCount, 0); checks++;
  await q('select public.record_patient_visit($1,$2)', [therapist, booking.patient_id]);
  assert.equal((await q("select * from public.search_patient_choices($1,'',true)", [therapist])).rowCount, 1); checks++;
  await q('update public.patient_assignments set ended_at=now() where patient_id=$1 and user_id=$2', [booking.patient_id, therapist]);
  assert.equal((await q("select * from public.search_patient_choices($1,'',true)", [therapist])).rowCount, 0); checks++;
  await q('update public.patient_assignments set ended_at=null where patient_id=$1 and user_id=$2', [booking.patient_id, therapist]);
  await rejects(() => q("select public.register_booking_outcome($1,$2,$3,'no_show','unknown','invoiced',null)", [therapist, id, booking.updated_at]), /invalid_input/);
  await rejects(() => q("select public.register_booking_outcome($1,$2,$3,'cancelled','late','unreviewed',null)", [other, id, booking.updated_at]), /not_allowed/);
  await rejects(() => q("select public.register_booking_outcome($1,$2,'2000-01-01','cancelled','late','unreviewed',null)", [therapist, id]), /agenda_changed/);
  const notifications = Number((await q('select count(*) from public.customer_notifications where booking_id=$1', [id])).rows[0].count);
  await q("select public.register_booking_outcome($1,$2,$3,'cancelled','late','unreviewed',null)", [therapist, id, booking.updated_at]);
  booking = await load(); check(() => { assert.equal(booking.status, 'cancelled'); assert.equal(booking.cancellation_category, 'late'); });
  assert.equal(Number((await q('select count(*) from public.customer_notifications where booking_id=$1', [id])).rows[0].count), notifications); checks++;
  assert.equal((await q("select * from public.booking_mail_jobs where booking_id=$1 and kind='cancelled'", [id])).rowCount, 0); checks++;
  assert.equal((await q("select * from public.booking_mail_jobs where booking_id=$1 and status='pending'", [id])).rowCount, 0); checks++;
  await q("select public.register_booking_outcome($1,$2,$3,'cancelled','timely','unreviewed',null)", [therapist, id, booking.updated_at]);
  assert.equal((await load()).cancellation_category, 'timely'); checks++;
  assert.equal(Number((await q("select count(*) from public.security_audit_log where object_id=$1 and action='booking.outcome_registered'", [id])).rows[0].count), 2); checks++;
  // A past booking supports no-show classification and audited corrections.
  const past = (await q("insert into public.bookings(practitioner_id,patient_id,customer_user_id,client_name,client_email,starts_at,ends_at,status,origin) values($1,$2,$3,'Synthetic past',$4,now()-interval '2 hours',now()-interval '1 hour','confirmed','staff') returning *,updated_at::text as updated_at", [owner, booking.patient_id, customer, email])).rows[0];
  const pastNotifications=(await q('select * from public.customer_notifications where booking_id=$1',[past.id])).rowCount;
  await q("select public.register_booking_outcome($1,$2,$3,'no_show','unknown','invoiced',null)", [therapist, past.id, past.updated_at]);
  const noShow = (await q('select *,updated_at::text as updated_at from public.bookings where id=$1', [past.id])).rows[0];
  check(() => { assert.equal(noShow.no_show_billing, 'invoiced'); assert.equal(noShow.status, 'no_show'); });
  assert.equal((await q('select * from public.customer_notifications where booking_id=$1', [past.id])).rowCount, pastNotifications); checks++;
  // Preference at send time cancels an already scheduled reminder.
  const later = new Date(Date.parse(start) + 86400000).toISOString();
  const laterId = (await q('select public.create_typed_staff_booking($1,$2,$3,$4,null) id', [therapist, booking.patient_id, offer, later])).rows[0].id;
  const laterReminder = (await q("select * from public.booking_mail_jobs where booking_id=$1 and kind='reminder'", [laterId])).rows[0];
  await q('insert into public.user_preferences(user_id,booking_reminder_enabled) values($1,false) on conflict(user_id) do update set booking_reminder_enabled=false', [customer]);
  assert.equal((await q('select public.booking_mail_is_current($1) ok', [laterReminder.id])).rows[0].ok, false); checks++;
  await q('update public.user_preferences set booking_reminder_enabled=true where user_id=$1',[customer]);
  await q('select public.refresh_customer_booking_reminders($1)',[customer]);
  assert.equal((await q("select status from public.booking_mail_jobs where id=$1",[laterReminder.id])).rows[0].status,'pending');checks++;
  await q("update public.booking_mail_jobs set scheduled_for=now()-interval '1 minute' where id=$1",[laterReminder.id]);
  assert.equal((await q('select public.booking_mail_is_current($1) ok',[laterReminder.id])).rows[0].ok,true);checks++;
  await q("update public.booking_mail_jobs set scheduled_for=now()-interval '16 minutes' where id=$1",[laterReminder.id]);
  assert.equal((await q('select public.booking_mail_is_current($1) ok',[laterReminder.id])).rows[0].ok,false);checks++;
  await q('select * from public.claim_booking_mail(1,$1)',[laterId]);
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[laterReminder.id])).rows[0].status,'superseded');checks++;
  const nextStart=new Date(Date.parse(later)+86400000).toISOString();
  await q('select public.reschedule_practice_appointment($1,$2,$3,null)',[therapist,laterId,nextStart]);
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[laterReminder.id])).rows[0].status,'superseded');checks++;
  await q('select public.reschedule_practice_appointment($1,$2,$3,null)',[therapist,laterId,later]);
  assert.equal((await q('select status from public.booking_mail_jobs where id=$1',[laterReminder.id])).rows[0].status,'pending');checks++;
  // Exact elapsed 72 hours spans the spring DST change (09:00 local, not 10:00).
  const dstBooking=(await q("insert into public.bookings(practitioner_id,patient_id,customer_user_id,client_name,client_email,starts_at,ends_at,status,origin) values($1,$2,$4,'Synthetic DST',$3,'2027-03-28T10:00:00+02:00','2027-03-28T11:00:00+02:00','confirmed','staff') returning id",[owner,booking.patient_id,email,customer])).rows[0].id;
  const dstDue=(await q("select to_char(scheduled_for at time zone 'Europe/Brussels','YYYY-MM-DD HH24:MI') due from public.booking_mail_jobs where booking_id=$1 and kind='reminder'",[dstBooking])).rows[0].due;
  assert.equal(dstDue,'2027-03-25 09:00');checks++;
  assert.equal((await q('select birth_date::text from public.patients where id=$1',[booking.patient_id])).rows[0].birth_date,'1990-05-12');checks++;
  const emptyName=`Synthetic empty ${randomUUID()}`;
  const empty=(await q('select public.create_patient_record($1,$2,null,null,null) id',[admin,emptyName])).rows[0].id;
  await rejects(()=>q("select public.delete_empty_patient($1,$2,$3,'test',null)",[admin,empty,emptyName]),/archive_first/);
  await q('select public.archive_patient_record($1,$2,true,null)',[admin,empty]);
  await rejects(()=>q("select public.delete_empty_patient($1,$2,$3,'test',null)",[therapist,empty,emptyName]),/not_allowed/);
  await rejects(()=>q("select public.delete_empty_patient($1,$2,'wrong','test',null)",[admin,empty]),/confirmation_required/);
  await q("update public.patients set registration_reason='Synthetic care' where id=$1",[empty]);
  await rejects(()=>q("select public.delete_empty_patient($1,$2,$3,'test',null)",[admin,empty,emptyName]),/care_data/);
  await q("update public.patients set registration_reason='' where id=$1",[empty]);
  await q("select public.delete_empty_patient($1,$2,$3,'test',null)",[admin,empty,emptyName]);
  assert.equal((await q('select 1 from public.patients where id=$1',[empty])).rowCount,0);checks++;
  assert.equal((await q("select 1 from public.security_audit_log where object_id=$1 and action='patient.empty_record_deleted'",[empty])).rowCount,1);checks++;
  await q('select public.archive_patient_record($1,$2,true,null)',[admin,booking.patient_id]);
  await rejects(()=>q("select public.delete_empty_patient($1,$2,$3,'duplicate',null)",[admin,booking.patient_id,booking.client_name]),/linked_account|appointments/);
  // Untrusted roles cannot call private APIs or inspect recent visits.
  await q('reset role'); await q('set local role anon');
  await rejects(() => q('select public.record_patient_visit($1,$2)', [therapist, booking.patient_id]), /permission denied/);
  await rejects(() => q('select * from public.patient_recent_visits'), /permission denied/);
  await rejects(() => q('select public.booking_mail_is_relevant($1)',[reminder.id]), /permission denied/);
  await q('reset role');
  // Exercise the real dispatch SQL with a network stub; NEVER issue an HTTP request.
  const netInstalled=(await q("select 1 from pg_extension where extname='pg_net'")).rowCount;
  if(!netInstalled){
   await q('create schema if not exists net');
   await q('create temporary table dispatch_calls(headers jsonb)');
   await q("create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$ begin insert into pg_temp.dispatch_calls values(headers);return 1;end; $$");
   for(const [name,value] of [['booking_reminder_endpoint','https://example.invalid/no-network'],['booking_reminder_token','synthetic-token']]){
    const found=await q('select id from vault.secrets where name=$1',[name]);
    if(!found.rowCount)await q('select vault.create_secret($1,$2)',[value,name]);
   }
   await q(fs.readFileSync('scripts/sql/booking-reminder-dispatch.sql','utf8'));
   // No production reminders exist before this migration; isolate the synthetic deadline.
   await q("update public.booking_mail_jobs set status='superseded' where kind='reminder'");
   await q('select public.dispatch_due_booking_reminders()');
   assert.equal((await q('select * from dispatch_calls')).rowCount,0);checks++;
   await q("update public.booking_mail_jobs set status='pending',scheduled_for=now(),next_attempt_at=now() where id=$1",[laterReminder.id]);
   await q('select public.dispatch_due_booking_reminders()');
   assert.equal((await q('select * from dispatch_calls')).rowCount,1);checks++;
   await q('set local role anon');
   await rejects(()=>q('select public.dispatch_due_booking_reminders()'),/permission denied/);
   await q('reset role');
  }
  console.log(`${checks} practice workflow database checks passed.`);
} finally { await q('rollback'); await c.end(); console.log('All migration changes and synthetic fixtures rolled back; no mail sent.'); }
