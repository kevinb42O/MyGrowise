// Actual PostgreSQL migration and routines in memory. No Supabase connection or real records.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();const q=(sql,args=[])=>db.query(sql,args);
const base=readFileSync(new URL('../supabase/migrations/20260924180000_client_records.sql',import.meta.url),'utf8');
const routine=name=>{const start=base.indexOf(`create function public.${name}(`);assert.ok(start>=0);return base.slice(start,base.indexOf('$$;',base.indexOf('as $$',start))+3);};
try {
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table profiles(id uuid primary key);create table user_roles(user_id uuid,role text);
 create table bookings(id uuid primary key,starts_at timestamptz);
 create table security_audit_log(actor_user_id uuid,action text,object_type text,object_id text,request_id uuid,request_path text,metadata jsonb);
 create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end; $$;`);
 await db.exec(base.slice(0,base.indexOf('create function public.create_patient_record(')));
 await db.exec(routine('create_patient_note'));await db.exec(routine('append_patient_note_version'));
 const author=uuid(),outsider=uuid(),patient=uuid();
 await q('insert into profiles values($1),($2)',[author,outsider]);await q("insert into user_roles values($1,'practitioner'),($2,'practitioner')",[author,outsider]);
 await q("insert into patients(id,full_name) values($1,'Synthetische cliënt')",[patient]);await q('insert into patient_assignments(patient_id,user_id) values($1,$2)',[patient,author]);
 const create="select create_patient_note($1,$2,null,'session',now(),'Verslag',$3,'draft') id";
 const legacy=(await q(create,[author,patient,'Bestaande gewone tekst'])).rows[0].id;
 await db.exec(readFileSync(new URL('../supabase/migrations/20261118193000_patient_note_formatting.sql',import.meta.url),'utf8'));
 assert.equal((await q('select body_document from patient_notes_current where id=$1',[legacy])).rows[0].body_document,null);
 // Old positional calls still work; defaults preserve legacy clients.
 const plain=(await q(create,[author,patient,'Nieuwe gewone tekst'])).rows[0].id;
 assert.equal((await q('select body_document from patient_notes_current where id=$1',[plain])).rows[0].body_document,null);
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Met opmaak',marks:[{type:'bold'}]}]}]};
 const rich=(await q("select create_patient_note($1,$2,null,'session',now(),'Verslag','Met opmaak','draft',null,null,$3::jsonb) id",[author,patient,JSON.stringify(doc)])).rows[0].id;
 const append='select append_patient_note_version($1,$2,$3,$4,$5,$6,null,$7::jsonb) version';
 await q(append,[author,rich,1,'Verslag gewijzigd','Met opmaak',false,JSON.stringify({...doc,content:[{type:'paragraph',content:[{type:'text',text:'Met opmaak',marks:[{type:'italic'}]}]}]})]);
 const versions=(await q('select version_number,body_document from patient_note_versions where note_id=$1 order by version_number',[rich])).rows;
 assert.deepEqual(versions[0].body_document,doc);assert.equal(versions[1].body_document.content[0].content[0].marks[0].type,'italic');
 const snapshot=async()=>JSON.stringify((await q('select * from patient_note_versions where note_id=$1 order by version_number',[rich])).rows);
 const before=await snapshot();
 await assert.rejects(()=>q(append,[author,rich,1,'Conflict','Andere tekst',false,null]),/version_conflict/);
 await assert.rejects(()=>q(append,[outsider,rich,2,'Verboden','Andere tekst',false,null]),/not_allowed/);
 await assert.rejects(()=>q('update patient_note_versions set body_document=null where note_id=$1',[rich]),/immutable/);
 assert.equal(await snapshot(),before);
 await assert.rejects(()=>q(append,[author,rich,2,'Foute opmaak','Met opmaak',false,'{"type":"script"}']),/document_shape/);
 assert.equal(await snapshot(),before);
 await q(append,[author,rich,2,'Definitief','Met opmaak',true,JSON.stringify(doc)]);
 await assert.rejects(()=>q(append,[author,rich,3,'Te laat','Met opmaak',false,null]),/note_locked/);
 assert.equal((await q('select body_document from patient_notes_current where id=$1',[rich])).rows[0].body_document.content[0].content[0].marks[0].type,'bold');
 for(const role of ['anon','authenticated'])assert.equal((await q(`select has_function_privilege('${role}','public.append_patient_note_version(uuid,uuid,integer,text,text,boolean,uuid,jsonb)','EXECUTE') ok`)).rows[0].ok,false);
 assert.equal((await q("select has_function_privilege('service_role','public.create_patient_note(uuid,uuid,uuid,text,timestamptz,text,text,text,uuid,uuid,jsonb)','EXECUTE') ok")).rows[0].ok,true);
 console.log('PASS: migration with existing notes, legacy calls, formatted immutable snapshots, conflicts, access denial, invalid JSON rollback, final lock, current view and RPC privileges.');
}finally{await db.close();}
