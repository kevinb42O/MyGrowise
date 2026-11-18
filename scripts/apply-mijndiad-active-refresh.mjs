// Rehearse by default; --apply registers the reviewed function-only migration.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const apply=process.argv.includes('--apply');
const file='20261118202000_mijndiad_active_refresh.sql',version=file.split('_')[0];
const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
let connected=false;
const body=(source,name)=>{
 const start=source.indexOf('function '+name+'(');assert.ok(start>=0);
 const begin=source.indexOf('as $$',start)+5;assert.ok(begin>4);
 return source.slice(begin,source.indexOf('$$;',begin)).trim();
};
try{
 await db.connect();connected=true;await db.query('begin');await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
 await db.query("select pg_advisory_xact_lock(hashtextextended('mygrowise_mijndiad_sync',0))");
 const existing=await db.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);
 const fingerprint=async()=>(await db.query(`select
  (select md5(coalesce(string_agg(md5(to_jsonb(e)::text),'' order by id),'')) from public.practice_calendar_events e) events,
  (select md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' order by id),'')) from public.bookings b) bookings,
  (select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by practitioner_id),'')) from practice_private.mijndiad_sync s) configuration`)).rows[0];
 const before=await fingerprint();
 if(existing.rowCount)assert.deepEqual(existing.rows[0].statements,[sql]);
 else{
  for(const [signature,baseline] of [
   ['practice_private.ensure_mijndiad_fresh(uuid,integer)','20261018194645_mijndiad_on_demand_sync.sql'],
   ['practice_private.mijndiad_sync_status(uuid)','20261117164000_mijndiad_pending_warning.sql'],
  ]){
   const source=readFileSync(new URL('../supabase/migrations/'+baseline,import.meta.url),'utf8');
   const actual=(await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[signature])).rows[0].prosrc.trim();
   assert.equal(actual,body(source,signature.split('(')[0]),'Live routine differs from reviewed baseline');
  }
  await db.query(sql);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])',[version,file.slice(15,-4),[sql]]);
 }
 assert.deepEqual(await fingerprint(),before,'Appointments, bookings and source configuration must remain unchanged');
 for(const role of ['anon','authenticated'])for(const fn of ['public.ensure_mijndiad_fresh(uuid,integer)','public.get_mijndiad_sync_status(uuid)','practice_private.ensure_mijndiad_fresh(uuid,integer)'])assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,fn])).rows[0].allowed,false);
 assert.equal((await db.query("select count(*)::int n from cron.job where jobname='mygrowise-mijndiad-sync' and active")).rows[0].n,0);
 const state=(await db.query("select public.get_mijndiad_sync_status(id) state from public.practitioners where slug='virginie'")).rows[0].state;
 assert.equal(state.intervalMinutes,1);assert.ok('retryAfterSeconds' in state);
 await db.query(apply?'commit':'rollback');
 console.log(JSON.stringify({mode:apply?'applied-and-registered':'rehearsed-and-rolled-back',version,rowsUnchanged:true,privatePermissionsVerified:true,syncCronInactive:true,activeIntervalSeconds:60}));
}catch(error){if(connected)await db.query('rollback').catch(()=>{});console.error('Active refresh migration failed:',error.message);process.exitCode=1;}
finally{await db.end();}
