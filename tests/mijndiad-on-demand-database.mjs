// Rollback-only integration checks; no persisted bookings, source config or jobs.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
const concurrent=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
let checks=0;
const q=(sql,args=[])=>c.query(sql,args);
const value=async(sql,args=[])=>(await q(sql,args)).rows[0].value;
const reject=async(fn,pattern)=>{await q('savepoint rejection');try{await fn();assert.fail('Expected rejection');}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.match(e.message,pattern);}finally{await q('rollback to savepoint rejection');}checks++;};
try{
 await c.connect();await concurrent.connect();await q('begin');await q("set local statement_timeout='30s';set local lock_timeout='5s'");
 await q("select pg_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0))");
 const migration='20261018194645_mijndiad_on_demand_sync.sql';
 if(!(await q('select 1 from supabase_migrations.schema_migrations where version=$1',[migration.split('_')[0]])).rowCount)await q(readFileSync(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
 const pid=(await q("select id from practitioners where slug='virginie'")).rows[0].id;
 const original=await value('select jsonb_agg(to_jsonb(e) order by id) value from public.practice_calendar_events e where external_source is null');
 const refresh=async(age=300)=>value('select public.ensure_mijndiad_fresh($1,$2) value',[pid,age]);
 const status=()=>value('select public.get_mijndiad_sync_status($1) value',[pid]);
 const age=async(seconds)=>q("update practice_private.mijndiad_sync set last_success_at=clock_timestamp()-make_interval(secs=>$2),last_attempt_at=clock_timestamp()-interval '1 hour',last_error=null,failure_count=0,enabled=true where practitioner_id=$1",[pid,seconds]);
 await age(600);let state=await refresh();assert.equal(state.usable,true);assert.equal(state.sync.mode,'on_demand');assert.ok(state.sync.eventCount>0);checks++;
 const attempt=state.sync.lastAttemptAt;
 for(let i=0;i<5;i++){state=await refresh();assert.equal(state.usable,true);assert.equal(state.sync.lastAttemptAt,attempt);}checks++;
 // Browse cache is 5 minutes, while booking preflight must be within 1 minute.
 await age(120);const before=await status();assert.equal((await refresh()).sync.lastAttemptAt,before.lastAttemptAt);checks++;
 state=await refresh(60);assert.equal(state.usable,true);assert.notEqual(state.sync.lastAttemptAt,before.lastAttemptAt);checks++;
 const other=await value('select public.ensure_mijndiad_fresh($1,60) value',[randomUUID()]);assert.deepEqual(other,{configured:false,usable:true,sync:null});checks++;
 const skipped=(await concurrent.query('select practice_private.sync_mijndiad_agenda() value')).rows[0].value;
 assert.equal(skipped.skipped,true);checks++;
 // Real HTTP fetch was validated above; use a deliberately invalid private
 // URL to exercise the same production failure and backoff path deterministically.
 const invalid=(await q("select vault.create_secret('https://example.invalid/','on_demand_test_'||gen_random_uuid()::text) id")).rows[0].id;
 await age(600);await q('update practice_private.mijndiad_sync set feed_secret_id=$2 where practitioner_id=$1',[pid,invalid]);
 const preserved=await status();state=await refresh();assert.equal(state.usable,false);assert.equal(state.sync.lastSuccessAt,preserved.lastSuccessAt);assert.equal(state.sync.failureCount,1);assert.equal(state.sync.lastError,'feed_unavailable_or_invalid');checks++;
 const failedAttempt=state.sync.lastAttemptAt;
 for(let i=0;i<5;i++){state=await refresh(60);assert.equal(state.usable,false);assert.equal(state.sync.failureCount,1);assert.equal(state.sync.lastAttemptAt,failedAttempt);}checks++;
 await q("update practice_private.mijndiad_sync set last_attempt_at=clock_timestamp()-interval '65 seconds' where practitioner_id=$1",[pid]);
 state=await refresh();assert.equal(state.sync.failureCount,2);checks++;
 await q("update practice_private.mijndiad_sync set last_attempt_at=clock_timestamp()-interval '65 seconds' where practitioner_id=$1",[pid]);
 state=await refresh();assert.equal(state.sync.failureCount,2);checks++;
 const offer=(await q('select id from public.practitioner_appointment_types where practitioner_id=$1 limit 1',[pid])).rows[0].id;
 await reject(()=>q('select * from public.get_offer_slots($1,3)',[offer]),/external_calendar_unavailable/);
 await reject(()=>q("select * from public.get_bookable_slots('virginie',3)"),/external_calendar_unavailable/);
 const booking=randomUUID();
 const insert=()=>q("insert into public.bookings(id,practitioner_id,client_name,client_email,starts_at,ends_at,status) values($1,$2,'Sync Test','sync-test@example.invalid','2035-01-08T09:00Z','2035-01-08T10:00Z','confirmed')",[booking,pid]);
 await reject(insert,/external_calendar_unavailable/);
 // A disabled configured source must also fail closed; other therapists work.
 await q('update practice_private.mijndiad_sync set enabled=false where practitioner_id=$1',[pid]);assert.equal((await refresh()).usable,false);checks++;
 await age(0);await insert();assert.ok((await q('select id from bookings where id=$1',[booking])).rowCount);checks++;
 await age(600);await q("update practice_private.mijndiad_sync set last_error='feed_unavailable_or_invalid',last_attempt_at=clock_timestamp() where practitioner_id=$1",[pid]);
 await reject(()=>q("update bookings set starts_at='2035-01-09T09:00Z',ends_at='2035-01-09T10:00Z' where id=$1",[booking]),/external_calendar_unavailable/);
 // Cancelling remains possible during a source outage.
 await q("update bookings set status='cancelled' where id=$1",[booking]);checks++;
 assert.deepEqual(await value('select jsonb_agg(to_jsonb(e) order by id) value from public.practice_calendar_events e where external_source is null'),original);checks++;
 assert.equal((await q("select active from cron.job where jobname='mygrowise-mijndiad-sync'")).rows[0]?.active??false,false);checks++;
 await q('set local role service_role');state=await refresh();assert.equal(state.usable,false);assert.ok(!JSON.stringify(state).includes('http'));checks++;
 await reject(()=>q('select * from practice_private.mijndiad_sync'),/permission denied/);await q('reset role');
 for(const role of ['anon','authenticated'])for(const signature of ['public.ensure_mijndiad_fresh(uuid,integer)','practice_private.ensure_mijndiad_fresh(uuid,integer)','practice_private.mijndiad_offer_slots_snapshot(uuid,integer)']){
  assert.equal(await value('select has_function_privilege($1,$2,\'execute\') value',[role,signature]),false);checks++;
 }
 console.log(`${checks} demand-sync checks passed: real refresh, shared cache, strict booking freshness, concurrency, outage backoff, stale-slot rejection, booking/reschedule protection, cancellation during outage, secret isolation and disabled cron.`);
}finally{await q('rollback').catch(()=>{});await c.end();await concurrent.end();console.log('All demand-sync test changes rolled back.');}
