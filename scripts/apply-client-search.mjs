// Apply only the two reviewed changes for client search; no unrelated migrations or clinical rows.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const apply = process.argv.includes('--apply');
const files = ['20261118200000_client_search_refinement.sql','20261118201000_client_search_update.sql'];
const db = new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
try {
 await db.connect();
 await db.query('begin');
 await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
 await db.query("select pg_advisory_xact_lock(hashtext('mygrowise-client-search-refinement'))");
 const processed=[];
 for(const file of files) {
  const version=file.split('_')[0];
  const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
  const existing=await db.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);
  if(existing.rowCount) assert.deepEqual(existing.rows[0].statements,[sql]);
  else {
   await db.query(sql);
   await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])',[version,file.slice(15,-4),[sql]]);
  }
  processed.push({version,existing:Boolean(existing.rowCount)});
 }
 const rights=(await db.query("select has_function_privilege('anon','search_patient_choices_v2(uuid,text,boolean,text,integer)','execute') anonymous,has_function_privilege('authenticated','search_patient_choices_v2(uuid,text,boolean,text,integer)','execute') browser,has_function_privilege('service_role','search_patient_choices_v2(uuid,text,boolean,text,integer)','execute') service")).rows[0];
 assert.deepEqual(rights,{anonymous:false,browser:false,service:true});
 const update=(await db.query("select slug,status,published,audience,(select count(*)::integer from platform_update_events e where e.update_id=u.id) events from platform_updates u where slug='clienten-sneller-terugvinden'")).rows[0];
 assert.equal(update.published,true); assert.equal(update.audience,'dashboard'); assert.ok(update.events>=1);
 await db.query(apply?'commit':'rollback');
 console.log(JSON.stringify({mode:apply?'applied-and-registered':'rehearsed-and-rolled-back',processed,rights,update},null,2));
} catch(error) {
 await db.query('rollback').catch(()=>{});
 console.error('Client search changes rolled back:',error.message);process.exitCode=1;
} finally {await db.end();}
