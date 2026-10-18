// Integration rehearsal runs in one rollback-only transaction; no mail is sent.
import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
const q=(s,p=[])=>c.query(s,p);let checks=0;
const hash=()=>createHash('sha256').update(randomBytes(32)).digest('hex');
const fail=async(fn,pattern)=>{await q('savepoint expected_failure');try{await assert.rejects(fn,pattern);checks++;}finally{await q('rollback to savepoint expected_failure');}};
try{
 await c.connect();await q('begin');await q("set local statement_timeout='25s';set local lock_timeout='5s'");
 const before=(await q('select count(*)::int n from auth.users')).rows[0].n;
 for(const file of ['20261018160435_practice_appointment_management.sql','20261018173304_commerce_guest_and_website_repair.sql']){
  const applied=(await q('select 1 from supabase_migrations.schema_migrations where version=$1',[file.split('_')[0]])).rowCount;
  if(!applied)await q(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 }
 for(const table of ['orders','entitlements','assessment_deliveries']){assert.equal((await q(`select count(*)::int n from public.${table} where buyer_id is null`)).rows[0].n,0);checks++;}
 const admin=randomUUID(),account=randomUUID(),other=randomUUID(),email=`commerce-${account}@example.invalid`;
 for(const [id,role] of [[admin,'super_admin'],[account,'customer'],[other,'customer']]){
  await q("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),'{}')",[id,id===account?email:`commerce-${id}@example.invalid`]);
  await q('delete from public.user_roles where user_id=$1',[id]);await q('insert into public.user_roles(user_id,role) values($1,$2)',[id,role]);
 }
 const questions=(await q("select p.id from public.products p join public.catalog_details d on d.product_id=p.id where p.type='questionnaire' and p.status='published' and d.availability='available' and p.price_cents=5900 order by p.id limit 4")).rows.map(r=>r.id);assert.equal(questions.length,4);
 const quote=async(ids,mode='custom')=>(await q('select public.catalog_quote($1,$2) v',[ids,mode])).rows[0].v;
 const contact={email,first_name:'Test',last_name:'Deelnemer',birth_date:'1990-03-04',gender:'unspecified',participant:'self'};
 const guest=async(ids,quoteHash,checkout=hash(),submission=randomUUID(),details=contact,mode='custom')=>(await q('select public.create_guest_catalog_order($1,$2,$3,$4,$5,$6) id',[checkout,ids,mode,quoteHash,submission,details])).rows[0].id;
 const firstQuote=await quote(questions.slice(0,2)),checkout=hash(),submission=randomUUID();
 const order=await guest(questions.slice(0,2),firstQuote.hash,checkout,submission);
 assert.equal(await guest(questions.slice(0,2),firstQuote.hash,checkout,submission),order);checks++;
 await fail(()=>guest(questions.slice(0,2),firstQuote.hash,checkout,submission,{...contact,first_name:'Ander'}),/submission_conflict/);
 await fail(()=>guest(questions.slice(0,2),'0'.repeat(32)),/quote_changed/);
 await fail(()=>quote([questions[0],questions[0]]),/invalid_selection/);
 assert.equal((await q('select customer_user_id from public.orders where id=$1',[order])).rows[0].customer_user_id,null);
 assert.equal((await q('select count(*)::int n from auth.users')).rows[0].n,before+3);checks++;
 for(const [n,pct,total] of [[1,0,5900],[2,5,11210],[3,5,16815],[4,10,21240]]){const result=await quote(questions.slice(0,n));assert.equal(result.discountPercent,pct);assert.equal(result.totalCents,total);assert.equal(result.items.reduce((sum,i)=>sum+i.priceCents,0),total);checks++;}
 assert.equal((await q('select count(*)::int n from public.entitlements e join public.order_items i on i.id=e.order_item_id where i.order_id=$1',[order])).rows[0].n,0);checks++;
 await q('select public.confirm_wise_manual_payment($1,$2)',[order,admin]);await q('select public.confirm_wise_manual_payment($1,$2)',[order,admin]);
 assert.equal((await q('select count(*)::int n from public.entitlements e join public.order_items i on i.id=e.order_item_id where i.order_id=$1 and e.customer_user_id is null and e.buyer_id is not null',[order])).rows[0].n,2);
 assert.equal((await q('select count(*)::int n from public.assessment_deliveries d join public.order_items i on i.id=d.order_item_id where i.order_id=$1 and d.customer_user_id is null',[order])).rows[0].n,2);checks++;
 const token=hash(),session=hash();await q("insert into public.commerce_access_tokens(token_hash,email,expires_at) values($1,$2,now()+interval '30 minutes')",[token,email]);
 assert.equal((await q('select public.consume_purchase_token($1,$2) ok',[token,session])).rows[0].ok,true);
 assert.equal((await q('select public.consume_purchase_token($1,$2) ok',[token,hash()])).rows[0].ok,false);checks++;
 const expired=hash();await q("insert into public.commerce_access_tokens(token_hash,email,expires_at) values($1,$2,now()-interval '1 second')",[expired,email]);assert.equal((await q('select public.consume_purchase_token($1,$2) ok',[expired,hash()])).rows[0].ok,false);checks++;
 await fail(()=>q('select public.link_guest_purchases($1,$2)',[other,session]),/forbidden/);
 const accountOrder=(await q("select public.create_account_checkout($1,$2,'custom',$3,$4,$5) id",[account,questions.slice(0,2),firstQuote.hash,randomUUID(),contact])).rows[0].id;
 await q('select public.confirm_wise_manual_payment($1,$2)',[accountOrder,admin]);
 await q('select public.link_guest_purchases($1,$2)',[account,session]);await q('select public.link_guest_purchases($1,$2)',[account,session]);
 assert.equal((await q('select count(*)::int n from public.orders where id=any($1) and customer_user_id=$2',[[order,accountOrder],account])).rows[0].n,2);
 assert.equal((await q("select count(*)::int n from public.entitlements where customer_user_id=$1 and status='active'",[account])).rows[0].n,2);
 assert.equal((await q('select count(*)::int n from public.assessment_deliveries where customer_user_id=$1',[account])).rows[0].n,4);checks++;
 await fail(()=>q("select public.create_account_checkout($1,$2,'custom',$3,$4,$5)",[account,questions.slice(0,2),firstQuote.hash,randomUUID(),{...contact,email:'wrong@example.invalid'}]),/buyer_mismatch/);
 const module=(await q("select product_id from public.module_details where format='module' order by number limit 1")).rows[0].product_id;
 await fail(()=>quote([module]),/unavailable_product|module_not_ready/);
 await fail(()=>q("select public.new_supplement($1,'Test','test-guide','pdf')",[other]),/forbidden/);
 const extras=[];
 for(const kind of ['pdf','audio']){
  const id=(await q('select public.new_supplement($1,$2,$3,$4) id',[admin,'Test extra',`test-${randomUUID()}`,kind])).rows[0].id;extras.push(id);
  await fail(()=>quote([id]),/unavailable_product/);
  await q("update public.products set status='published',price_cents=1200 where id=$1",[id]);
  await q("update public.module_details set audience_text='Testdoelgroep',access_text='Testtoegang',support_text='Zelfstudie' where product_id=$1",[id]);
  await fail(()=>q("update public.catalog_details set availability='available' where product_id=$1",[id]),/module_not_ready/);
  const release=(await q('select public.begin_module_release($1,$2) id',[admin,id])).rows[0].id;
  const rev=async()=>(await q('select revision from public.module_releases where id=$1',[release])).rows[0].revision;
  const asset=(await q('select * from public.reserve_module_asset($1,$2,$3,$4,$5,$6,$7,$8)',[admin,release,await rev(),kind,'exercise','Testbestand',200,1])).rows[0];
  await fail(async()=>q('select public.publish_module_release($1,$2,$3,true)',[admin,release,await rev()]),/module_incomplete/);
  await q('select public.verify_module_asset($1,$2)',[admin,asset.id]);await q('select public.publish_module_release($1,$2,$3,true)',[admin,release,await rev()]);
  assert.equal((await q('select public.module_ready($1) ready',[id])).rows[0].ready,true);
  await q("update public.catalog_details set availability='available' where product_id=$1",[id]);checks++;
  await fail(()=>q("update public.products set type='questionnaire' where id=$1",[id]),/module_type_locked/);
 }
 const combined=await quote([extras[0],extras[1],questions[0]]);assert.equal(combined.discountPercent,5);assert.equal(combined.totalCents,7885);checks++;
 const extraOrder=await guest(extras,(await quote(extras)).hash,hash(),randomUUID(),{...contact,email:'extra@example.invalid'});
 await q('select public.confirm_wise_manual_payment($1,$2)',[extraOrder,admin]);assert.equal((await q('select count(*)::int n from public.assessment_deliveries d join public.order_items i on i.id=d.order_item_id where i.order_id=$1',[extraOrder])).rows[0].n,0);checks++;
 let revision=(await q('select revision from public.module_details where product_id=$1',[module])).rows[0].revision;
 await q('select public.save_module_recommendations($1,$2,$3,$4)',[admin,module,revision,[extras[1],questions[0],extras[0]]]);
 assert.deepEqual((await q('select target_product_id from public.module_recommendations where module_product_id=$1 order by sort_order',[module])).rows.map(r=>r.target_product_id),[extras[1],questions[0],extras[0]]);checks++;
 await fail(()=>q('select public.save_module_recommendations($1,$2,$3,$4)',[admin,module,revision,[]]),/revision_conflict/);
 await fail(()=>q('select public.save_module_recommendations($1,$2,$3,$4)',[other,module,revision+1,[]]),/forbidden/);
 const prikkel=(await q("select id from public.products where slug='prikkelverwerkingsprofiel'")).rows[0].id;const profileQuote=await quote([prikkel],'package');assert.equal(profileQuote.discountPercent,0);
 for(const [birth,expected] of [['2012-01-01','FEEL-KJ'],['1990-01-01','FEEL-E']]){
  const profileOrder=await guest([prikkel],profileQuote.hash,hash(),randomUUID(),{...contact,birth_date:birth},'package');
  const snapshot=(await q('select catalog_snapshot from public.order_items where order_id=$1',[profileOrder])).rows[0].catalog_snapshot;
  assert.equal(snapshot.components.length,2);assert.ok(snapshot.components.some(x=>x.title===expected));checks++;
  await q('select public.confirm_wise_manual_payment($1,$2)',[profileOrder,admin]);assert.ok((await q('select title from public.assessment_deliveries d join public.order_items i on i.id=d.order_item_id where i.order_id=$1',[profileOrder])).rows.some(x=>x.title===expected));checks++;
 }
 await fail(()=>guest([prikkel],profileQuote.hash,hash(),randomUUID(),{...contact,birth_date:'2025-01-01'},'package'),/invalid_profile_age/);
 const mailKey=randomUUID();for(let i=0;i<2;i++)await q("insert into public.website_mail_jobs(kind,payload,submission_key) values('contact','{\"email\":\"test@example.invalid\"}',$1) on conflict(submission_key) do nothing",[mailKey]);assert.equal((await q('select count(*)::int n from public.website_mail_jobs where submission_key=$1',[mailKey])).rows[0].n,1);checks++;
 const claimed=(await q('select * from public.claim_website_mail(20)')).rows;assert.ok(claimed.length);assert.ok(claimed.every(j=>j.lease_token&&j.attempts===1));assert.equal((await q('select * from public.claim_website_mail(20)')).rows.length,0);checks++;
 // Brussels midnight and DST: compare calendar dates, not a fixed 24-hour gap.
 for(const [now,start,allowed] of [['2026-10-24T21:59:00Z','2026-10-24T22:00:00Z',true],['2026-10-24T22:00:00Z','2026-10-25T10:00:00Z',false],['2026-03-28T23:00:00Z','2026-03-29T20:00:00Z',false],['2026-03-29T21:59:00Z','2026-03-29T22:00:00Z',true]]){
  assert.equal((await q("select timezone('Europe/Brussels',$1::timestamptz)::date < timezone('Europe/Brussels',$2::timestamptz)::date ok",[now,start])).rows[0].ok,allowed);checks++;
 }
 assert.equal((await q("select count(*)::int n from public.practitioner_appointment_types o cross join lateral public.get_offer_slots(o.id,2) s where timezone('Europe/Brussels',s.starts_at)::date<=timezone('Europe/Brussels',now())::date")).rows[0].n,0);checks++;
 assert.equal((await q("select count(*)::int n from public.practitioners p cross join lateral public.get_bookable_slots(p.slug,2) s where timezone('Europe/Brussels',s.starts_at)::date<=timezone('Europe/Brussels',now())::date")).rows[0].n,0);checks++;
 for(const role of ['anon','authenticated']){
  await q(`set local role ${role}`);
  for(const table of ['commerce_buyers','commerce_access_tokens','commerce_sessions','website_mail_jobs','module_recommendations'])await fail(()=>q(`select * from public.${table}`),/permission denied/);
  await fail(()=>q('select public.consume_purchase_token($1,$2)',[token,hash()]),/permission denied/);
  await fail(()=>q('select public.link_guest_purchases($1,$2)',[account,session]),/permission denied/);await q('reset role');
 }
 console.log(`${checks} commerce database checks passed: guest pricing/payment, account compatibility, no hidden registration, tokens, linking, recommendations, file-specific extras, profile variants, calendar dates and permissions.`);
}finally{await q('rollback').catch(()=>{});await c.end();console.log('Rolled back all test data and schema changes; no mail sent.');}
