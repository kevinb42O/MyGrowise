// Actual migration SQL in an isolated PostgreSQL runtime, with synthetic jobs only.
// PGLITE_MODULE=/absolute/path/to/pglite/dist/index.cjs node tests/admin-mail-isolated-db.mjs
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table support_mail_jobs(id uuid primary key,kind text,status text,attempts int,created_at timestamptz,sent_at timestamptz,next_attempt_at timestamptz,lease_until timestamptz,last_error text);
 create table commerce_mail_jobs(id uuid primary key,event text,status text,attempts int,created_at timestamptz,sent_at timestamptz,next_attempt_at timestamptz,lease_until timestamptz,last_error text);
 create table booking_mail_jobs(id uuid primary key,kind text,status text,attempts int,created_at timestamptz,sent_at timestamptz,next_attempt_at timestamptz,lease_until timestamptz,last_error text);
 create table website_mail_jobs(id uuid primary key,kind text,status text,attempts int,created_at timestamptz,sent_at timestamptz,next_attempt_at timestamptz,lease_until timestamptz);
 grant select on support_mail_jobs,commerce_mail_jobs,booking_mail_jobs,website_mail_jobs to service_role;`);
 const stamp='2026-11-18T10:00:00Z';
 const insert=async(table,n,{kind='confirmation',status='sent',date=stamp,error=null}={})=>{
  const id=`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const key=table==='commerce_mail_jobs'?'event':'kind';
  await db.query(`insert into ${table}(id,${key},status,attempts,created_at,sent_at${table!=='website_mail_jobs'?',last_error':''}) values($1,$2,$3,1,$4,$5${table!=='website_mail_jobs'?',$6':''})`,[id,kind,status,stamp,date,...(table!=='website_mail_jobs'?[error]:[])]);
  return id;
 };
 await insert('support_mail_jobs',1,{error:'smtp://private-user@secret.invalid'});
 await insert('support_mail_jobs',2,{date:null});
 await insert('commerce_mail_jobs',1,{kind:'paid'});
 await insert('commerce_mail_jobs',2,{error:'delivery_access_inactive'});
 await insert('commerce_mail_jobs',3,{date:null});
 await insert('booking_mail_jobs',1);
 await insert('booking_mail_jobs',2,{status:'suppressed'});
 await insert('booking_mail_jobs',3,{status:'superseded'});
 await insert('booking_mail_jobs',4,{status:'pending'});
 await insert('booking_mail_jobs',5,{status:'sending'});
 await insert('website_mail_jobs',1,{kind:'contact'});
 await insert('website_mail_jobs',2,{kind:'purchase_access'});
 await db.exec(readFileSync(new URL('../supabase/migrations/20261118130000_website_mail_delivery_outcome.sql',import.meta.url),'utf8'));
 const skipped=await insert('website_mail_jobs',3,{kind:'purchase_access',date:null});
 await db.query("update website_mail_jobs set delivery_outcome='skipped' where id=$1",[skipped]);
 const missing=await insert('website_mail_jobs',4,{kind:'contact',date:null});
 await db.query("update website_mail_jobs set delivery_outcome='sent' where id=$1",[missing]);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261118150000_admin_mail_overview.sql',import.meta.url),'utf8'));
 const all=(await db.query('select * from admin_mail_overview')).rows;
 assert.equal(all.length,14);
 assert.equal(all.filter(row=>row.display_status==='sent').length,4);
 assert.equal(all.filter(row=>row.display_status==='unconfirmed').length,6);
 assert.equal(all.filter(row=>row.display_status==='pending').length,1);
 assert.equal(all.filter(row=>row.display_status==='sending').length,1);
 assert.equal(new Set(all.map(row=>row.queue+row.id)).size,14);
 const fields=Object.keys(all[0]);
 for(const field of ['payload','recipient','last_error','lease_token','delivery_outcome'])assert.ok(!fields.includes(field));
 assert.ok(!JSON.stringify(all).includes('secret.invalid'));
 assert.equal(all.find(row=>row.queue==='support_mail_jobs'&&row.id.endsWith('000001')).diagnosis_code,'unknown_error');
 assert.equal(all.find(row=>row.queue==='commerce_mail_jobs'&&row.id.endsWith('000002')).completion_outcome,'skipped');
 assert.equal(all.find(row=>row.queue==='website_mail_jobs'&&row.id.endsWith('000002')).completion_outcome,'unconfirmed');
 const counts=(await db.query('select * from admin_mail_counts()')).rows;
 assert.equal(counts.reduce((sum,row)=>sum+Number(row.total),0),12,'suppressed and superseded jobs do not enter active history totals');
 for(const row of counts)assert.equal(Number(row.total),all.filter(job=>job.queue===row.queue&&job.display_status===row.status).length);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select * from public.admin_mail_overview'),/permission denied/);
  await assert.rejects(db.query('select * from public.admin_mail_counts()'),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 assert.equal((await db.query('select * from public.admin_mail_overview')).rows.length,14);
 assert.equal((await db.query('select * from public.admin_mail_counts()')).rows.length,counts.length);
 await assert.rejects(db.query("update public.admin_mail_overview set attempts=0"),/permission denied|not automatically updatable|cannot update view/);
 await db.exec('reset role');
 console.log('PASS actual migration SQL: all queues, safe projection, correct historical outcomes, counts, composite identities and server-only privileges.');
} finally {await db.close();}
