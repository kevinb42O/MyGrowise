// Transactional integration tests: no users, orders, schema changes or queued mails retained.
// Verified asset rows simulate the server's storage validation; browser/storage delivery is checked separately.
import pg from 'pg';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});let checks=0;
const q=(s,p=[])=>db.query(s,p);const rejects=async(fn,pattern)=>{await q('savepoint expected_failure');try{await assert.rejects(fn,pattern);checks++;}finally{await q('rollback to savepoint expected_failure');}};
try{
 await db.connect();await q('begin');await q("set local statement_timeout='20s';set local lock_timeout='10s'");
 if(process.env.TEST_MODULE_SCHEMA==='1')await q(readFileSync(new URL('../supabase/migrations/20261018162741_module_materials.sql',import.meta.url),'utf8'));
 const admin=randomUUID(),customer=randomUUID(),outsider=randomUUID();
 for(const id of [admin,customer,outsider])await q("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),'{}')",[id,`module-test-${id}@example.invalid`]);
 await q('delete from public.user_roles where user_id=$1',[admin]);await q("insert into public.user_roles(user_id,role) values($1,'super_admin')",[admin]);
 const modules=(await q('select product_id from public.module_details order by number')).rows.map(r=>r.product_id);assert.equal(modules.length,6);checks++;
 await rejects(async()=>q("update public.catalog_details set availability='available' where product_id=$1",[modules[0]]),/module_not_ready/);
 await rejects(async()=>q('select public.begin_module_release($1,$2)',[customer,modules[0]]),/forbidden/);
 const draft=async id=>(await q('select public.begin_module_release($1,$2) id',[admin,id])).rows[0].id;
 const rev=async id=>(await q('select revision from public.module_releases where id=$1',[id])).rows[0].revision;
 const reserve=async(release,kind,key='exercise')=>(await q('select * from public.reserve_module_asset($1,$2,$3,$4,$5,$6,$7,$8)',[admin,release,await rev(release),kind,key,kind==='pdf'?'Werkboek':'Oefening',200,1])).rows[0];
 const ready=async id=>{
  const r=await draft(id);assert.equal(await draft(id),r);checks++;
  await rejects(async()=>q('select public.publish_module_release($1,$2,$3,true)',[admin,r,await rev(r)]),/module_incomplete/);
  const pdf=await reserve(r,'pdf');const audio=await reserve(r,'audio');
  await rejects(async()=>q('select public.publish_module_release($1,$2,$3,true)',[admin,r,await rev(r)]),/module_incomplete/);
  for(const a of [pdf,audio])await q('select public.verify_module_asset($1,$2)',[admin,a.id]);
  await rejects(async()=>q('select public.publish_module_release($1,$2,$3,false)',[admin,r,await rev(r)]),/module_incomplete/);
  await rejects(async()=>q('select public.publish_module_release($1,$2,0,true)',[admin,r]),/revision_conflict/);
  await q('select public.publish_module_release($1,$2,$3,true)',[admin,r,await rev(r)]);
  await rejects(async()=>q('select public.edit_module_asset($1,$2,$3,$4,1,false)',[admin,audio.id,await rev(r),'Changed']),/revision_conflict/);
  await q("update public.module_details set audience_text='Testdoelgroep',access_text='Testtoegang',support_text='Zelfstudie' where product_id=$1",[id]);
  await q("update public.catalog_details set availability='available' where product_id=$1",[id]);return {r,pdf,audio};
 };
 const first=await ready(modules[0]);const second=await ready(modules[1]);
 const questions=(await q("select id,slug from public.products where slug in ('cerq','rs-nl') order by slug")).rows;assert.equal(questions.length,2);
 const quote=async ids=>(await q("select public.catalog_quote($1::uuid[],'custom') result",[ids])).rows[0].result;
 for(const [ids,total,pct] of [[[modules[0]],8900,0],[[modules[0],modules[1]],16910,5],[[modules[0],modules[1],questions[0].id],22515,5],[[modules[0],modules[1],...questions.map(x=>x.id)],26640,10]]){const result=await quote(ids);assert.equal(result.totalCents,total);assert.equal(result.discountPercent,pct);assert.equal(result.items.reduce((s,x)=>s+x.priceCents,0),total);checks++;}
 await rejects(()=>quote([modules[2]]),/unavailable_product|module_not_ready/);await rejects(()=>quote([modules[0],modules[0]]),/invalid_selection/);
 const ids=[modules[0],modules[1],questions[0].id];const result=await quote(ids);const key=randomUUID();
 const order=async(selection=ids,hash=result.hash,submission=key)=>(await q("select public.create_catalog_order($1,$2::uuid[],'custom',$3,$4) id",[customer,selection,hash,submission])).rows[0].id;
 const orderId=await order();assert.equal(await order(),orderId);assert.equal(await order(ids,result.hash,randomUUID()),orderId);checks++;
 const smaller=await quote([modules[0]]);await rejects(()=>order([modules[0]],smaller.hash,randomUUID()),/module_pending_order/);
 await q('select public.confirm_wise_manual_payment($1,$2)',[orderId,admin]);await q('select public.confirm_wise_manual_payment($1,$2)',[orderId,admin]);
 assert.equal((await q('select count(*)::int n from public.entitlements where customer_user_id=$1',[customer])).rows[0].n,3);
 assert.equal((await q('select count(*)::int n from public.assessment_deliveries where customer_user_id=$1',[customer])).rows[0].n,1);checks++;
 assert.equal((await q("select count(*)::int n from public.entitlements where customer_user_id=$1 and product_type='module'",[outsider])).rows[0].n,0);checks++;
 await rejects(()=>order(ids,result.hash,randomUUID()),/module_already_owned/);
 await q("update public.catalog_details set availability='paused' where product_id=$1",[modules[0]]);assert.equal((await q("select count(*)::int n from public.entitlements where product_id=$1 and status='active'",[modules[0]])).rows[0].n,1);checks++;
 await rejects(()=>quote([modules[0]]),/unavailable_product/);await q("update public.catalog_details set availability='available' where product_id=$1",[modules[0]]);
 const newDraft=await draft(modules[0]);assert.notEqual(newDraft,first.r);assert.equal((await q('select count(*)::int n from public.module_assets where release_id=$1',[newDraft])).rows[0].n,2);checks++;
 const replacement=await reserve(newDraft,'audio');assert.equal(replacement.track_id,first.audio.track_id);assert.notEqual(replacement.object_path,first.audio.object_path);checks++;
 await q('select public.verify_module_asset($1,$2)',[admin,replacement.id]);
 const before=(await q('select revision from public.module_details where product_id=$1',[modules[0]])).rows[0].revision;
 await q('select public.publish_module_release($1,$2,$3,true)',[admin,newDraft,await rev(newDraft)]);
 assert.equal((await q('select current_release_id from public.module_details where product_id=$1',[modules[0]])).rows[0].current_release_id,newDraft);checks++;
 await rejects(async()=>q('select public.restore_module_release($1,$2,$3,$4)',[admin,modules[0],first.r,before]),/revision_conflict/);
 const currentRev=(await q('select revision from public.module_details where product_id=$1',[modules[0]])).rows[0].revision;
 await rejects(async()=>q('select public.restore_module_release($1,$2,$3,$4)',[admin,modules[0],second.r,currentRev]),/invalid_module/);
 await q('select public.restore_module_release($1,$2,$3,$4)',[admin,modules[0],first.r,currentRev]);checks++;
 await rejects(async()=>q("update public.products set type='questionnaire' where id=$1",[modules[0]]),/module_type_locked/);
 await rejects(async()=>q('update public.module_assets set product_id=$1 where id=$2',[modules[1],first.audio.id]),/foreign key/);
 for(const role of ['anon','authenticated']){await q(`set local role ${role}`);for(const table of ['module_details','module_releases','module_tracks','module_assets'])await rejects(async()=>q(`select * from public.${table}`),/permission denied/);await rejects(async()=>q('select public.begin_module_release($1,$2)',[admin,modules[0]]),/permission denied/);await q('reset role');}
 assert.equal((await q("select count(*)::int n from pg_class where relname in ('module_details','module_releases','module_tracks','module_assets') and relrowsecurity")).rows[0].n,4);assert.equal((await q("select public from storage.buckets where id='module-materials'")).rows[0].public,false);checks++;
 console.log(`${checks} module database checks passed: mixed pricing, complete releases, immutable identities, revisions, snapshots, paid delivery, duplicates, restoration and private access.`);
}finally{await q('rollback').catch(()=>{});await db.end();console.log('Transaction rolled back; no test schema, accounts, orders or queued mail retained.');}
