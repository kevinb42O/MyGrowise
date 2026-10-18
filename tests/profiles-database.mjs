import 'dotenv/config';
import pg from 'pg';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
const file='20261018200657_profile_landings_and_release_readiness.sql';
const entries=JSON.parse(readFileSync(new URL('../docs/content/profile-landings.json',import.meta.url),'utf8'));
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});let checks=0;
try{
 await db.connect();await db.query('begin');await db.query("set local statement_timeout='20s';set local lock_timeout='5s'");
 if(!(await db.query('select 1 from supabase_migrations.schema_migrations where version=$1',[file.split('_')[0]])).rowCount)await db.query(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const expectFailure=async(fn,pattern)=>{await db.query('savepoint rejected');await assert.rejects(fn,pattern);await db.query('rollback to savepoint rejected');checks++;};
 for(const e of entries){assert.equal((await db.query('select public.valid_profile_landing($1) valid',[e.content])).rows[0].valid,true);checks++;}
 for(const patch of [{question:''},{ageMax:1},{themes:['constructor']},{ownCount:31},{instrumentLines:[]},{extra:true}]){assert.equal((await db.query('select public.valid_profile_landing($1) valid',[{...entries[0].content,...patch}])).rows[0].valid,false);checks++;}
 const actor=randomUUID();await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",[actor,`profile-test-${actor}@example.invalid`]);await db.query('delete from public.user_roles where user_id=$1',[actor]);await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[actor]);
 const data={title:'Temporary profile',slug:`test-profile-${randomUUID()}`,type:'profile',status:'draft',summary:'Only a temporary profile test fixture.',priceCents:10000,availability:'paused',category:'Test',audience:'Volwassenen',ageLabel:'18+',version:'',description:'Test',includesText:'Test',deliveryText:'Test',reviewNote:'',image:'/images/editorial/mygrowise-50.jpg',sortOrder:0,costNote:'',components:[],profileLanding:entries[0].content};
 const id=(await db.query('select public.save_catalog_product($1,$2) id',[actor,data])).rows[0].id;checks++;
 const saved=async()=>(await db.query('select p.title,d.profile_landing from public.products p join public.catalog_details d on d.product_id=p.id where p.id=$1',[id])).rows[0];assert.deepEqual((await saved()).profile_landing,data.profileLanding);checks++;
 const old={...data,id};delete old.profileLanding;await db.query('select public.save_catalog_product($1,$2)',[actor,old]);assert.deepEqual((await saved()).profile_landing,data.profileLanding);checks++;
 await expectFailure(()=>db.query('select public.save_catalog_product($1,$2)',[actor,{...data,id,title:'Must roll back',profileLanding:{...data.profileLanding,ageMax:2}}]),/profile_landing_valid/);assert.equal((await saved()).title,data.title);checks++;
 await expectFailure(()=>db.query('select public.save_catalog_product($1,$2)',[randomUUID(),data]),/forbidden/);
 for(const role of ['anon','authenticated']){assert.equal((await db.query("select has_function_privilege($1,'public.save_catalog_product(uuid,jsonb)','execute') allowed",[role])).rows[0].allowed,false);checks++;}
 await db.query('rollback');console.log(`${checks} profile database checks passed; all mutations rolled back.`);
}catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
