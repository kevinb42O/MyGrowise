// All writes, including an optional candidate schema, run inside one rolled-back transaction.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const entries=JSON.parse(readFileSync(new URL('../docs/content/questionnaire-landings.json',import.meta.url),'utf8'));
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
let checks=0;
const rejects=async(fn,pattern)=>{
 await db.query('savepoint expected_failure');
 try{await assert.rejects(fn,pattern);checks++;}finally{await db.query('rollback to savepoint expected_failure');}
};
try{
 await db.connect();await db.query('begin');await db.query("set local lock_timeout='10s';set local statement_timeout='30s'");
 if(process.env.TEST_LANDING_SCHEMA==='1')await db.query(readFileSync(new URL('../supabase/migrations/20261018162030_questionnaire_landing_content.sql',import.meta.url),'utf8'));
 for(const entry of entries){
  assert.equal((await db.query('select public.valid_questionnaire_landing($1::jsonb) valid,public.valid_catalog_audience_groups($2::text[]) groups',[JSON.stringify(entry.landingContent),entry.audienceGroups])).rows[0].valid,true);
  checks++;
 }
 const admin=randomUUID();
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",[admin,`questionnaire-test-${admin}@example.invalid`]);
 await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin') on conflict do nothing",[admin]);
 const {rows:[p]}=await db.query("select p.*,to_jsonb(d) details,to_jsonb(c) costs from public.products p join public.catalog_details d on d.product_id=p.id left join public.catalog_costs c on c.product_id=p.id where p.slug='hipic'");
 const d=p.details,c=p.costs;
 const edit={id:p.id,title:p.title,slug:p.slug,type:p.type,status:p.status,summary:p.summary,priceCents:p.price_cents,category:d.category,audience:d.audience,ageLabel:d.age_label,version:d.version,availability:d.availability,description:d.description,includesText:d.includes_text,deliveryText:d.delivery_text,reviewNote:d.review_note,image:d.image,sortOrder:d.sort_order,costCents:c?.publisher_cost_cents??null,costNote:c?.cost_note||'',components:[],landingContent:entries[0].landingContent,audienceGroups:entries[0].audienceGroups};
 await db.query('select public.save_catalog_product($1,$2::jsonb)',[admin,JSON.stringify(edit)]);
 const saved=(await db.query('select landing_content,audience_groups from public.catalog_details where product_id=$1',[p.id])).rows[0];
 assert.deepEqual(saved.landing_content,edit.landingContent);assert.deepEqual(saved.audience_groups,edit.audienceGroups);checks++;
 const oldCall={...edit};delete oldCall.landingContent;delete oldCall.audienceGroups;
 await db.query('select public.save_catalog_product($1,$2::jsonb)',[admin,JSON.stringify(oldCall)]);
 assert.deepEqual((await db.query('select landing_content,audience_groups from public.catalog_details where product_id=$1',[p.id])).rows[0],saved);checks++;
 await rejects(()=>db.query('select public.save_catalog_product($1,$2::jsonb)',[randomUUID(),JSON.stringify(edit)]),/forbidden/);
 for(const patch of [{landingContent:{}},{landingContent:{...edit.landingContent,measures:['']}},{audienceGroups:['adults','adults']},{audienceGroups:['other']},{audienceGroups:[]},{audienceGroups:[null]}])await rejects(()=>db.query('select public.save_catalog_product($1,$2::jsonb)',[admin,JSON.stringify({...edit,...patch})]),/invalid_|missing_audience/);
 await rejects(()=>db.query("update public.catalog_details set landing_content='{}'::jsonb where product_id=$1",[p.id]),/catalog_landing_content_valid/);
 await db.query('select public.save_catalog_product($1,$2::jsonb)',[admin,JSON.stringify({...edit,landingContent:null,audienceGroups:[]})]);
 assert.equal((await db.query('select landing_content from public.catalog_details where product_id=$1',[p.id])).rows[0].landing_content,null);checks++;
 for(const role of ['anon','authenticated']){
  await db.query(`set local role ${role}`);
  await rejects(()=>db.query('select public.save_catalog_product($1,$2::jsonb)',[admin,JSON.stringify(edit)]),/permission denied/);
  await rejects(()=>db.query('select * from public.catalog_details'),/permission denied/);
  await db.query('reset role');
 }
 const rights=(await db.query("select relrowsecurity from pg_class where oid='public.catalog_details'::regclass")).rows[0];assert.equal(rights.relrowsecurity,true);checks++;
 console.log(`${checks} checks passed: full content, editor round trip, old calls, invalid input, role restrictions and RLS.`);
}finally{await db.query('rollback').catch(()=>{});await db.end();console.log('Transaction rolled back; no schema or catalog test changes retained.');}
