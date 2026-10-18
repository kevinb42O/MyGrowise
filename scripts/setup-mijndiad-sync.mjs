// Rehearses by default. --apply enables demand-driven sync, without a recurring job.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMijndiadCalendar} from './lib/mijndiad-ical.mjs';
const apply=process.argv.includes('--apply');
const migrations=['20261018192839_mijndiad_automatic_sync.sql','20261018194645_mijndiad_on_demand_sync.sql'];
const feedUrl=process.env.MIJNDIAD_ICAL_URL;
assert.match(feedUrl||'',/^https:\/\/praktijkitransform\.mijndiad\.nl\/public\/ical\/[a-f0-9]+\.ics$/);
const response=await fetch(feedUrl,{signal:AbortSignal.timeout(15000),redirect:'error'});
assert.equal(response.status,200);const body=await response.text();
console.log('Feed fetched; preparing server-side configuration.');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
try{
 await db.connect();await db.query('begin');await db.query("set local lock_timeout='10s';set local statement_timeout='60s'");
 const owner=(await db.query("select id from public.practitioners where slug='virginie' and active and user_id is not null")).rows;
 assert.equal(owner.length,1);const pid=owner[0].id;
 for(const migration of migrations){
 const version=migration.split('_')[0];
 if(!(await db.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount){
  const sql=readFileSync(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8');await db.query(sql);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])',[version,migration.slice(15,-4),[sql]]);
 }
 }
 console.log('Schema prepared.');
 const expected=parseMijndiadCalendar(body,pid);
 const parsed=(await db.query('select practice_private.parse_mijndiad_calendar($1,$2) events',[body,pid])).rows[0].events;
 assert.deepEqual(parsed,expected,'Database parser must exactly match the verified Node importer for every field.');
 console.log('All calendar fields match the verified importer.');
 const secretName='mygrowise_mijndiad_virginie_feed';
 let secret=(await db.query('select id from vault.secrets where name=$1',[secretName])).rows[0]?.id;
 if(secret)await db.query('select vault.update_secret($1,$2)',[secret,feedUrl]);
 else secret=(await db.query('select vault.create_secret($1,$2,$3) id',[feedUrl,secretName,'Private MijnDiAd feed for Virginie; demand-driven sync only'])).rows[0].id;
 await db.query(`insert into practice_private.mijndiad_sync(practitioner_id,feed_secret_id,enabled,event_count) values($1,$2,true,$3)
   on conflict(practitioner_id) do update set feed_secret_id=excluded.feed_secret_id,enabled=true`,[pid,secret,expected.length]);
 // Exercise the actual shared freshness path. A recent successful cache is valid.
 const result=(await db.query('select public.ensure_mijndiad_fresh($1,60) result',[pid])).rows[0].result;
 assert.equal(result.usable,true,'Server-side fetch must succeed or have a recent successful cache.');
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query("select has_function_privilege($1,'public.refresh_mijndiad_agenda()','execute') allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_table_privilege($1,'practice_private.mijndiad_sync','select') allowed",[role])).rows[0].allowed,false);
 }
 await db.query("select cron.alter_job(jobid,active:=false) from cron.job where jobname='mygrowise-mijndiad-sync'");
 assert.equal((await db.query("select 1 from cron.job where jobname='mygrowise-mijndiad-sync' and active")).rowCount,0);
 const status=(await db.query('select public.get_mijndiad_sync_status($1) status',[pid])).rows[0].status;
 assert.ok(status.lastSuccessAt);assert.equal(status.enabled,true);
 await db.query(apply?'commit':'rollback');
 console.log(JSON.stringify({committed:apply,parsedExactly:expected.length,serverFetch:result,mode:'on_demand',cacheSeconds:300,bookingCacheSeconds:60,jobActive:false,status}));
}catch(error){await db.query('rollback').catch(()=>{});console.error('Sync setup rolled back:',String(error.message).replaceAll(feedUrl,'[private feed]').slice(0,1500));process.exitCode=1;}
finally{await db.end();}
