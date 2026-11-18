// Transactional rehearsal: synthetic snapshots and fetch stub are rolled back.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
let checks=0,connected=false;
try {
 await db.connect();connected=true;await db.query('begin');
 await db.query("set local statement_timeout='30s';set local lock_timeout='5s'");
 await db.query("select pg_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0))");
 await db.query(readFileSync(new URL('../supabase/migrations/20261118202000_mijndiad_active_refresh.sql',import.meta.url),'utf8'));
 const pid=(await db.query("select id from public.practitioners where slug='virginie'")).rows[0].id;
 const val=async(sql,args=[])=>(await db.query(sql,args)).rows[0].value;
 const status=()=>val('select public.get_mijndiad_sync_status($1) value',[pid]);
 const snapshots=await val(`select jsonb_agg(jsonb_build_object('id',id,'externalUid',external_uid,'title',title,'startsAt',starts_at,'endsAt',ends_at,'status',status,'kind',event_kind,'location',location,'color',color,'externalUrl',external_url)) value from public.practice_calendar_events where practitioner_id=$1 and external_source='mijndiad'`,[pid]);
 assert.ok(snapshots.length>1);
 const edge=Math.max(...snapshots.map(e=>Date.parse(e.endsAt)));
 const candidate=snapshots.find(e=>e.status==='confirmed'&&Date.parse(e.startsAt)>Date.now()+86400000&&Date.parse(e.endsAt)<edge);
 assert.ok(candidate);
 const apply=events=>val('select practice_private.apply_mijndiad_snapshot($1,$2::jsonb) value',[pid,JSON.stringify(events)]);
 const row=()=>val('select to_jsonb(e) value from public.practice_calendar_events e where id=$1',[candidate.id]);
 const age=seconds=>db.query("update practice_private.mijndiad_sync set last_success_at=clock_timestamp()-make_interval(secs=>$2),last_attempt_at=clock_timestamp()-make_interval(secs=>$2),last_error=null,failure_count=0,enabled=true where practitioner_id=$1",[pid,seconds]);
 const ensure=age=>val('select public.ensure_mijndiad_fresh($1,$2) value',[pid,age]);
 await apply(snapshots);await age(10);
 let state=await status();assert.equal(state.intervalMinutes,1);assert.ok(state.retryAfterSeconds>=49&&state.retryAfterSeconds<=51);assert.ok(state.nextCheckAt);checks++;
 const absent=snapshots.filter(e=>e.id!==candidate.id);
 await apply(absent);assert.equal((await row()).status,'confirmed');assert.equal((await row()).external_missing_count,1);checks++;
 // Fetch fixture replaces network work inside this transaction only.
 await db.query("select set_config('mygrowise.test_snapshot',$1,true)",[JSON.stringify(absent)]);
 await db.query(`create or replace function practice_private.sync_mijndiad_agenda() returns jsonb language plpgsql security definer set search_path='' as $$
 declare owner_id uuid; result jsonb;
 begin
  select practitioner_id into owner_id from practice_private.mijndiad_sync where enabled limit 1;
  update practice_private.mijndiad_sync set last_attempt_at=clock_timestamp() where practitioner_id=owner_id;
  result:=practice_private.apply_mijndiad_snapshot(owner_id,current_setting('mygrowise.test_snapshot')::jsonb);
  return result;
 end; $$`);
 await age(30);state=await ensure(300);assert.equal((await row()).external_missing_count,1);assert.equal(state.usable,true);checks++;
 await age(65);state=await ensure(300);assert.equal((await row()).status,'cancelled');assert.equal(state.sync.pendingMissing,0);assert.equal(state.usable,true);checks++;
 // Restoring a missing event before confirmation must reset the counter.
 await apply(snapshots);await apply(absent);await apply(snapshots);assert.equal((await row()).status,'confirmed');assert.equal((await row()).external_missing_count,0);checks++;
 // Normal public reads still use the five-minute shared cache.
 await db.query('update practice_private.mijndiad_sync set pending_missing=99 where practitioner_id=$1',[pid]);
 await age(120);assert.equal((await status()).pendingMissing,0);checks++;const before=(await status()).lastAttemptAt;state=await ensure(300);assert.equal(state.sync.lastAttemptAt,before);checks++;
 state=await ensure(60);assert.notEqual(state.sync.lastAttemptAt,before);checks++;
 for(const [failure,seconds] of [[1,60],[2,120],[3,240],[4,480],[5,900],[20,900]]){
  await db.query("update practice_private.mijndiad_sync set last_attempt_at=clock_timestamp(),last_error='feed_unavailable_or_invalid',failure_count=$2 where practitioner_id=$1",[pid,failure]);
  state=await status();assert.ok(state.retryAfterSeconds>=seconds-1&&state.retryAfterSeconds<=seconds);checks++;
 }
 await db.query('update practice_private.mijndiad_sync set enabled=false where practitioner_id=$1',[pid]);state=await status();assert.equal(state.retryAfterSeconds,null);assert.equal(state.nextCheckAt,null);checks++;
 for(const role of ['anon','authenticated'])for(const fn of ['public.ensure_mijndiad_fresh(uuid,integer)','public.get_mijndiad_sync_status(uuid)','practice_private.ensure_mijndiad_fresh(uuid,integer)']){
  assert.equal(await val('select has_function_privilege($1,$2,\'execute\') value',[role,fn]),false);checks++;
 }
 assert.equal(await val("select count(*)::int value from cron.job where jobname='mygrowise-mijndiad-sync' and active"),0);checks++;
 console.log(`${checks} active-refresh database checks passed: relative timing, two-snapshot confirmation, restored events, faster pending reads, preserved public cache, outage backoff, permissions and no active sync job.`);
} finally {if(connected)await db.query('rollback').catch(()=>{});await db.end();console.log('All active-refresh test changes rolled back.');}
