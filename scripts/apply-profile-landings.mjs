// Rehearse by default. Apply only the reviewed additive profile migration.
import 'dotenv/config';import pg from 'pg';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const files=['20261018200657_profile_landings_and_release_readiness.sql','20261018201657_profile_catalog_labels.sql'],apply=process.argv.includes('--apply');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
try{
 await db.connect();await db.query('begin');await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
 const counts=async()=>(await db.query('select (select count(*) from public.orders) orders,(select count(*) from public.entitlements) rights,(select count(*) from public.assessment_deliveries) deliveries,(select count(*) from public.bookings) bookings')).rows[0];
 const before=await counts();
 for(const file of files){const version=file.split('_')[0];
 if(!(await db.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount){
  const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');await db.query(sql);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])',[version,file.slice(15,-4),[sql]]);
 }
 }
 assert.deepEqual(await counts(),before,'Existing customer records must remain unchanged.');
 assert.equal((await db.query('select count(*)::int n from public.catalog_details where profile_landing is not null')).rows[0].n,8);
 await db.query(apply?'commit':'rollback');console.log(apply?'Profile migration applied and registered; existing orders, rights, deliveries and bookings preserved.':'Profile migration rehearsed and rolled back.');
}catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
