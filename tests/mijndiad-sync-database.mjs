import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMijndiadCalendar} from '../scripts/lib/mijndiad-ical.mjs';
const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
let checks=0;
try{
 await c.connect();await c.query('begin');await c.query("set local statement_timeout='30s';set local lock_timeout='5s'");
 await c.query("select pg_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0))");
 if(!(await c.query("select 1 from information_schema.tables where table_schema='practice_private' and table_name='mijndiad_sync'")).rowCount){
  await c.query(readFileSync(new URL('../supabase/migrations/20261018192839_mijndiad_automatic_sync.sql',import.meta.url),'utf8'));
 }
 const pid=(await c.query("select id from public.practitioners where slug='virginie'")).rows[0].id;
 const r=await fetch(process.env.MIJNDIAD_ICAL_URL,{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);
 const body=await r.text();const expected=parseMijndiadCalendar(body,pid);
 const parsed=(await c.query('select practice_private.parse_mijndiad_calendar($1,$2) value',[body,pid])).rows[0].value;
 assert.deepEqual(parsed,expected);checks++;
 const dummy=(await c.query("select vault.create_secret('https://example.invalid/','mijndiad_test_'||gen_random_uuid()::text) id")).rows[0].id;
 await c.query(`insert into practice_private.mijndiad_sync(practitioner_id,feed_secret_id,event_count,enabled)
 values($1,$2,$3,true) on conflict(practitioner_id) do update set feed_secret_id=excluded.feed_secret_id,event_count=excluded.event_count,enabled=true,last_attempt_at=null`,[pid,dummy,parsed.length]);
 const localBefore=(await c.query("select jsonb_agg(to_jsonb(e) order by id) value from public.practice_calendar_events e where e.external_source is null or e.practitioner_id<>$1",[pid])).rows[0].value;
 const snapshot=async events=>(await c.query('select practice_private.apply_mijndiad_snapshot($1,$2::jsonb) value',[pid,JSON.stringify(events)])).rows[0].value;
 const row=async id=>(await c.query('select * from public.practice_calendar_events where id=$1',[id])).rows[0];
 await snapshot(parsed);assert.equal((await snapshot(parsed)).changed,0);checks++;
 const max=Math.max(...parsed.map(e=>Date.parse(e.startsAt)));
 const candidate=parsed.find(e=>e.status==='confirmed'&&Date.parse(e.startsAt)>Date.now()+86400000&&Date.parse(e.startsAt)<max);
 assert.ok(candidate);
 const moved=parsed.map(e=>e.id===candidate.id?{...e,startsAt:new Date(Date.parse(e.startsAt)+15*60000).toISOString(),endsAt:new Date(Date.parse(e.endsAt)+15*60000).toISOString()}:e);
 await snapshot(moved);assert.equal(+new Date((await row(candidate.id)).starts_at),Date.parse(candidate.startsAt)+15*60000);checks++;
 await snapshot(parsed);
 const absent=parsed.filter(e=>e.id!==candidate.id);
 await snapshot(absent);assert.equal((await row(candidate.id)).status,'confirmed');assert.equal((await row(candidate.id)).external_missing_count,1);checks++;
 await snapshot(absent);assert.equal((await row(candidate.id)).status,'cancelled');checks++;
 await snapshot(parsed);assert.equal((await row(candidate.id)).status,'confirmed');assert.equal((await row(candidate.id)).external_missing_count,0);checks++;
 await snapshot(parsed.map(e=>e.id===candidate.id?{...e,status:'cancelled'}:e));assert.equal((await row(candidate.id)).status,'cancelled');checks++;
 await snapshot(parsed);
 const fail=async fn=>{await c.query('savepoint failure_test');let failed=false;try{await fn();}catch{failed=true;}await c.query('rollback to savepoint failure_test');assert.ok(failed);checks++;};
 await fail(()=>snapshot(parsed.slice(0,1)));
 for(const malformed of ['<html>Login</html>',body.replace('END:VCALENDAR',''),body.replace('END:VEVENT','RRULE:FREQ=WEEKLY\nEND:VEVENT')]){
  await fail(()=>c.query('select practice_private.parse_mijndiad_calendar($1,$2)',[malformed,pid]));
 }
 for(const start of ['20260329T023000','20261025T023000','20260230T100000']){
  await fail(()=>c.query("select practice_private.mijndiad_instant(jsonb_build_object('name','DTSTART;TZID=Europe/Brussels','value',$1::text))",[start]));
 }
 const statusBefore=(await c.query('select public.get_mijndiad_sync_status($1) value',[pid])).rows[0].value;
 const failure=(await c.query('select practice_private.sync_mijndiad_agenda() value')).rows[0].value;
 assert.equal(failure.ok,false);
 const statusAfter=(await c.query('select public.get_mijndiad_sync_status($1) value',[pid])).rows[0].value;
 assert.equal(statusAfter.lastSuccessAt,statusBefore.lastSuccessAt);assert.equal(statusAfter.lastError,'feed_unavailable_or_invalid');checks++;
 assert.deepEqual((await c.query("select jsonb_agg(to_jsonb(e) order by id) value from public.practice_calendar_events e where e.external_source is null or e.practitioner_id<>$1",[pid])).rows[0].value,localBefore);checks++;
 await c.query('set local role service_role');
 const status=(await c.query('select public.get_mijndiad_sync_status($1) value',[pid])).rows[0].value;
 assert.ok(status.lastSuccessAt);assert.ok(!JSON.stringify(status).includes('http'));checks++;
 await fail(()=>c.query('select * from practice_private.mijndiad_sync'));
 await fail(()=>c.query('select practice_private.apply_mijndiad_snapshot($1,$2)',[pid,JSON.stringify(parsed)]));
 await c.query('reset role');
 for(const role of ['anon','authenticated'])for(const signature of ['public.refresh_mijndiad_agenda()','public.get_mijndiad_sync_status(uuid)','practice_private.sync_mijndiad_agenda()']){
  assert.equal((await c.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,signature])).rows[0].allowed,false);checks++;
 }
 console.log(`${checks} database checks passed: exact import, idempotency, moving, cancelling, two-snapshot reconciliation, restoration, malformed feeds, DST, access control, safe failure state, preserved local events.`);
}finally{await c.query('rollback').catch(()=>{});await c.end();console.log('All test changes rolled back.');}
