// In-memory PostgreSQL rehearsal. Never connects to Supabase or a mail transport.
// Run with PGLITE_MODULE=/absolute/path/to/pglite/dist/index.cjs node tests/client-details-isolated-db.mjs
// The fixture is scoped to the changed routines; unrelated platform services are excluded.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID as uuid} from 'node:crypto';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const q=(sql,args=[])=>db.query(sql,args);
const exec=sql=>db.exec(sql);
const routine=(file,name)=>{
 const sql=readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8');
 const start=sql.indexOf(`create function public.${name}(`);
 assert.ok(start>=0,name);
 const end=sql.indexOf('$$;',sql.indexOf('as $$',start));
 return sql.slice(start,end+3);
};
let checks=0;
async function rejects(sql,args,pattern){await assert.rejects(()=>q(sql,args),e=>pattern.test(e.message));checks++;}
try{
 await exec(`
 create role anon; create role authenticated; create role service_role;
 create table user_roles(user_id uuid,role text);
 create table practice_managers(user_id uuid);
 create table patients(id uuid primary key default gen_random_uuid(),full_name text not null,email text,created_by uuid,customer_user_id uuid unique,status text default 'active',updated_at timestamptz default now(),intake_date date,
 first_name text default '',last_name text default '',birth_date date,street text default '',house_number text default '',address_box text default '',postal_code text default '',city text default '',country text default 'BE',mobile text default '',national_number text default '',gender text default '',salutation text default '',registration_reason text default '',referrer text default '',
 constraint patients_extended_fields check(salutation in ('','heer','meneer','mevrouw')));
 create table commerce_buyers(customer_user_id uuid unique,email text,first_name text,last_name text);
 create table patient_assignments(patient_id uuid references patients(id),user_id uuid,assigned_by uuid,ended_at timestamptz);
 create unique index assignments_active on patient_assignments(patient_id,user_id) where ended_at is null;
 create table security_audit_log(actor_user_id uuid,action text,object_type text,object_id text,request_id uuid,request_path text,metadata jsonb);
 create table practitioners(id uuid primary key,user_id uuid,active boolean,online_instructions text);
 create table appointment_types(id uuid primary key,name text,session_kind text,channel text,location text,duration_minutes int,active boolean);
 create table practitioner_appointment_types(id uuid primary key,practitioner_id uuid references practitioners(id),appointment_type_id uuid references appointment_types(id),duration_minutes int,active boolean);
 create table bookings(id uuid primary key default gen_random_uuid(),practitioner_id uuid,patient_id uuid references patients(id),customer_user_id uuid,client_name text,client_email text,starts_at timestamptz,ends_at timestamptz,status text,origin text,calendar_booked_at timestamptz,offer_id uuid,appointment_name text,session_kind text,channel text,location text,instructions text);
 create table staff_booking_submissions(actor_id uuid,submission_key uuid,booking_id uuid references bookings(id),input jsonb,primary key(actor_id,submission_key));
 `);
 for(const [file,name] of [
 ['20260924180000_client_records.sql','create_patient_record'],['20260924180000_client_records.sql','patient_actor_can_access'],
 ['20261018160435_practice_appointment_management.sql','is_practice_manager'],['20261018160435_practice_appointment_management.sql','create_typed_staff_booking'],
 ['20261117170000_practice_workflow_fixes.sql','book_new_patient'],
 ])await exec(routine(file,name));
 await exec(readFileSync(new URL('../supabase/migrations/20261117180000_patient_names_and_salutations.sql',import.meta.url),'utf8'));
 await exec(readFileSync(new URL('../supabase/migrations/20261029061435_remove_patient_national_number.sql',import.meta.url),'utf8'));
 await exec(readFileSync(new URL('../supabase/migrations/20261118120000_complete_patient_creation.sql',import.meta.url),'utf8'));
 const admin=uuid(),therapist=uuid(),other=uuid(),owner=uuid(),type=uuid(),offer=uuid();
 await q("insert into user_roles values($1,'super_admin'),($2,'practitioner'),($3,'practitioner')",[admin,therapist,other]);
 await q("insert into practitioners values($1,$2,true,'')",[owner,therapist]);
 await q("insert into appointment_types values($1,'Test','intake','online','',60,true)",[type]);
 await q('insert into practitioner_appointment_types values($1,$2,$3,60,true)',[offer,owner,type]);
 const complete='select create_patient_with_details($1,$2::jsonb,$3,null) id';
 const details={first_name:'Anne',last_name:'Compleet',email:'complete@example.invalid',birth_date:'1988-02-29',gender:'female',salutation:'mevrouw',intake_date:'2026-11-17',street:'Teststraat',house_number:'12',address_box:'A',postal_code:'1000',city:'Brussel',country:'BE',mobile:'+32 470 12 34 56',registration_reason:'Een eerste gesprek',referrer:'Huisarts'};
 const completeId=(await q(complete,[therapist,JSON.stringify(details),null])).rows[0].id;
 const saved=(await q('select * from patients where id=$1',[completeId])).rows[0];
 for(const [field,value] of Object.entries(details)) assert.equal(saved[field] instanceof Date?saved[field].toISOString().slice(0,10):saved[field],value,field);
 checks++;
 const counts=async()=> (await q('select (select count(*) from patients) patients,(select count(*) from patient_assignments) assignments,(select count(*) from security_audit_log) audits')).rows[0];
 const before=await counts();
 await rejects(complete,[therapist,JSON.stringify({...details,salutation:'forged'}),null],/patients_extended_fields/);
 assert.deepEqual(await counts(),before);checks++;
 await rejects(complete,[therapist,JSON.stringify(details),other],/not_allowed/);
 assert.deepEqual(await counts(),before);checks++;
 assert.equal((await q("select has_function_privilege('authenticated','public.create_patient_with_details(uuid,jsonb,uuid,uuid)','EXECUTE') ok")).rows[0].ok,false);checks++;
 const manual='select create_patient_with_names($1,$2,$3,$4,$5,null) id';
 const patient=(await q(manual,[therapist,'Anne Marie','Van den Berg','anne@example.invalid',null])).rows[0].id;
 assert.deepEqual((await q('select first_name,last_name,email,full_name from patients where id=$1',[patient])).rows[0],{first_name:'Anne Marie',last_name:'Van den Berg',email:'anne@example.invalid',full_name:'Anne Marie Van den Berg'});checks++;
 assert.equal((await q('select user_id from patient_assignments where patient_id=$1',[patient])).rows[0].user_id,therapist);checks++;
 await rejects(manual,[therapist,'Other','Name','a@example.invalid',other],/not_allowed/);
 await rejects(manual,[therapist,'','Name','a@example.invalid',null],/invalid_patient/);
 for(const salutation of ['','heer','meneer','mevrouw','heer_mevrouw','guardians','couple']){
  await q('update patients set salutation=$1 where id=$2',[salutation,patient]);
  assert.equal((await q('select salutation from patients where id=$1',[patient])).rows[0].salutation,salutation);checks++;
 }
 await rejects('update patients set salutation=$1 where id=$2',['forged',patient],/patients_extended_fields/);
 const book='select book_new_patient_with_names($1,$2,$3,$4,$5,$6,$7,$8,null) id';
 const key=uuid(),args=[therapist,key,'Zoë Marie','Van der Test','zoe@example.invalid',offer,'2090-05-20T10:00:00Z','1990-05-12'];
 const id=(await q(book,args)).rows[0].id;
 assert.equal((await q(book,args)).rows[0].id,id);checks++;
 const row=(await q('select p.* from patients p join bookings b on b.patient_id=p.id where b.id=$1',[id])).rows[0];
 assert.equal(row.first_name,'Zoë Marie');assert.equal(row.last_name,'Van der Test');assert.equal(row.birth_date.toISOString().slice(0,10),'1990-05-12');checks++;
 await q("update patients set first_name='Later edit' where id=$1",[row.id]);await q(book,args);
 assert.equal((await q('select first_name from patients where id=$1',[row.id])).rows[0].first_name,'Later edit');checks++;
 await rejects(book,[...args.slice(0,2),'Zoë','Marie Van der Test',...args.slice(4)],/idempotency_conflict/);
 const count=Number((await q('select count(*) n from patients')).rows[0].n);
 await rejects(book,[other,uuid(),'Forbidden','Therapist','other@example.invalid',offer,args[6],args[7]],/not_allowed/);
 assert.equal(Number((await q('select count(*) n from patients')).rows[0].n),count);checks++;
 await rejects(book,[therapist,uuid(),'Duplicate','Name',args[4],offer,args[6],args[7]],/potential_patient_match/);
 await q('update practitioner_appointment_types set active=false where id=$1',[offer]);
 await rejects(book,[therapist,uuid(),'Inactive','Type','inactive@example.invalid',offer,args[6],args[7]],/not_allowed/);
 assert.equal(Number((await q('select count(*) n from patients')).rows[0].n),count);checks++;
 // Deliberately failed booking insert proves the preceding patient/assignment/audit insert rolls back.
 await q('update practitioner_appointment_types set active=true where id=$1',[offer]);
 await exec("alter table bookings add constraint synthetic_conflict check(client_email<>'conflict@example.invalid')");
 await rejects(book,[therapist,uuid(),'Conflict','Rollback','conflict@example.invalid',offer,args[6],args[7]],/synthetic_conflict/);
 assert.equal(Number((await q('select count(*) n from patients')).rows[0].n),count);checks++;
 // Repair needs an existing explicit account link, exact name, and both trustworthy parts.
 const customer=uuid(),legacy=uuid(),unlinked=uuid();
 await q("insert into patients(id,full_name,email,customer_user_id) values($1,'Jean Pierre Van de Test','legacy@example.invalid',$2),($3,'Jean Pierre Van de Test','legacy@example.invalid',null)",[legacy,customer,unlinked]);
 await q("insert into commerce_buyers values($1,'legacy@example.invalid','Jean Pierre','Van de Test')",[customer]);
 const repair=(await q('select repair_missing_patient_names() result')).rows[0].result;
 assert.equal(repair.repaired,1);checks++;
 assert.equal((await q('select first_name from patients where id=$1',[legacy])).rows[0].first_name,'Jean Pierre');checks++;
 assert.equal((await q('select first_name from patients where id=$1',[unlinked])).rows[0].first_name,'');checks++;
 assert.equal((await q('select repair_missing_patient_names() result')).rows[0].result.repaired,0);checks++;
 await q("update patients set last_name='Preserved' where id=$1",[legacy]);await q('select repair_missing_patient_names()');
 assert.equal((await q('select last_name from patients where id=$1',[legacy])).rows[0].last_name,'Preserved');checks++;
 const linked=(await q("insert into patients(full_name,customer_user_id) values('Jean Pierre Van de Test',$1) returning first_name,last_name",[uuid()])).rows[0];
 assert.equal(linked.first_name,'');checks++;
 assert.equal((await q("select has_function_privilege('authenticated','public.create_patient_with_names(uuid,text,text,text,uuid,uuid)','EXECUTE') ok")).rows[0].ok,false);checks++;
 console.log(`${checks} isolated PostgreSQL checks passed; no external database or mail transport used.`);
}finally{await db.close();}
