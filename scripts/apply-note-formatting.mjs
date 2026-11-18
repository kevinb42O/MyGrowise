// Apply only the reviewed note-formatting migration; default is a rolled-back rehearsal.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file='20261118193000_patient_note_formatting.sql';
const version=file.split('_')[0];
const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
const apply=process.argv.includes('--apply');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
const signatures=[
 'public.create_patient_note(uuid,uuid,uuid,text,timestamptz,text,text,text,uuid,uuid,jsonb)',
 'public.append_patient_note_version(uuid,uuid,integer,text,text,boolean,uuid,jsonb)',
];
try {
 assert.ok(process.env.SUPABASE_DB_URL,'SUPABASE_DB_URL is required');
 await db.connect();
 await db.query('begin isolation level repeatable read');
 await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
 await db.query("select pg_advisory_xact_lock(hashtext('mygrowise-note-formatting-migration'))");
 const existing=await db.query('select statements from supabase_migrations.schema_migrations where version=$1',[version]);
 const snapshot=async()=> (await db.query(`select
  (select count(*) from public.patients) patients,
  (select count(*) from public.patient_notes) notes,
  (select count(*) from public.patient_note_versions) versions,
  (select md5(coalesce(string_agg(md5((to_jsonb(v)-'body_document')::text),'' order by id),'')) from public.patient_note_versions v) versions_fingerprint,
  (select md5(coalesce(string_agg(md5(to_jsonb(n)::text),'' order by id),'')) from public.patient_notes n) notes_fingerprint`)).rows[0];
 const before=await snapshot();
 if(existing.rowCount)assert.deepEqual(existing.rows[0].statements,[sql],'Registered migration differs from reviewed file');
 else {
  // Stop if the routines were changed after the base migration; do not replace unknown logic.
  const base=readFileSync(new URL('../supabase/migrations/20260924180000_client_records.sql',import.meta.url),'utf8');
  for(const [name,signature] of [['create_patient_note','public.create_patient_note(uuid,uuid,uuid,text,timestamptz,text,text,text,uuid,uuid)'],['append_patient_note_version','public.append_patient_note_version(uuid,uuid,integer,text,text,boolean,uuid)']]){
   const start=base.indexOf('create function public.'+name+'(');
   const bodyStart=base.indexOf('as $$',start)+5;
   const expected=base.slice(bodyStart,base.indexOf('$$;',bodyStart));
   const actual=await db.query('select prosrc from pg_proc where oid=$1::regprocedure',[signature]);
   assert.equal(actual.rows[0]?.prosrc.trim(),expected.trim(),'Live routine differs from reviewed baseline: '+name);
  }
  // The migration's own BEGIN/COMMIT are removed so checks and ledger registration share one transaction.
  const transactional=sql.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
  await db.query(transactional);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])',[version,file.slice(15,-4),[sql]]);
 }
 assert.deepEqual(await snapshot(),before,'Existing note text, versions and dossier counts must remain unchanged');
 const shape=await db.query("select data_type from information_schema.columns where table_schema='public' and table_name='patient_note_versions' and column_name='body_document'");
 assert.equal(shape.rows[0]?.data_type,'jsonb');
 assert.equal((await db.query("select count(*)::int count from information_schema.columns where table_schema='public' and table_name='patient_notes_current' and column_name='body_document'")).rows[0].count,1);
 for(const signature of signatures){
  const {rows:[grants]}=await db.query("select has_function_privilege('anon',$1,'EXECUTE') anonymous,has_function_privilege('authenticated',$1,'EXECUTE') browser,has_function_privilege('service_role',$1,'EXECUTE') service",[signature]);
  assert.deepEqual(grants,{anonymous:false,browser:false,service:true});
 }
 await db.query("notify pgrst,'reload schema'");
 await db.query(apply?'commit':'rollback');
 console.log(JSON.stringify({mode:apply?'applied-and-registered':'rehearsed-and-rolled-back',version,alreadyRegistered:Boolean(existing.rowCount),preservedExistingNotes:true,privateRpcGrantsVerified:true,documentColumnAndViewVerified:true}));
} catch(error) {
 await db.query('rollback').catch(()=>{});
 console.error('Note formatting migration rolled back:',error.message);
 process.exitCode=1;
} finally {await db.end();}
