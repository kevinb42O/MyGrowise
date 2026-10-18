// Default: rehearse and roll back. --apply records the verified migrations atomically.
import 'dotenv/config';import pg from 'pg';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const apply=process.argv.includes('--apply');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
const files=['20261018160435_practice_appointment_management.sql','20261018173304_commerce_guest_and_website_repair.sql','20261018175636_website_profile_copy.sql','20261018180042_website_booking_duration.sql'];
const counts=async()=>{const r={};for(const table of ['orders','entitlements','assessment_deliveries','bookings','practitioners','patients'])r[table]=Number((await db.query(`select count(*) n from public.${table}`)).rows[0].n);return r;};
try{
 await db.connect();await db.query('begin');await db.query("set local lock_timeout='5s';set local statement_timeout='60s'");await db.query("select pg_advisory_xact_lock(hashtext('mygrowise_website_repair'))");
 const before=await counts();
 for(const file of files){const [version,...parts]=file.replace('.sql','').split('_');const exists=await db.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version]);if(exists.rowCount){console.log('Already registered:',file);continue;}
  const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');await db.query(sql);await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])',[version,parts.join('_'),[sql]]);console.log('Verified migration:',file);
 }
 assert.deepEqual(await counts(),before,'Existing record counts must be preserved');
 for(const table of ['orders','entitlements','assessment_deliveries'])assert.equal(Number((await db.query(`select count(*) n from public.${table} where buyer_id is null`)).rows[0].n),0,table+' backfill');
 for(const table of ['entitlements','assessment_deliveries'])assert.equal(Number((await db.query(`select count(*) n from public.${table} d join public.order_items i on i.id=d.order_item_id join public.orders o on o.id=i.order_id where d.buyer_id<>o.buyer_id or d.customer_user_id is distinct from o.customer_user_id`)).rows[0].n),0,table+' ownership');
 await db.query(apply?'commit':'rollback');console.log(apply?'Committed and registered.':'Rehearsal rolled back.');console.log('Preserved record counts:',before);
}catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
