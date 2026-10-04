// Integration checks run inside one transaction and ALWAYS roll back. No mail is sent.
import pg from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const client=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
await client.connect();let checks=0;
const query=(s,p=[])=>client.query(s,p);
const rejects=async(fn,reason)=>{await query('savepoint expected_failure');try{await fn();assert.fail(`Expected ${reason}`);}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.match(e.message,new RegExp(reason));}finally{await query('rollback to savepoint expected_failure');}checks++;};
try{
 await query('begin');await query("set local statement_timeout='15s'");
 const customer=randomUUID(),admin=randomUUID();
 for(const [id,kind] of [[customer,'customer'],[admin,'super_admin']]){await query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')",[id,`catalog-test-${id}@example.invalid`]);if(kind==='super_admin'){await query('delete from public.user_roles where user_id=$1',[id]);await query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[id]);}}
 const products=(await query("select id,slug,price_cents from public.products where type in ('questionnaire','profile')")).rows;const id=slug=>products.find(x=>x.slug===slug).id;
 const quote=async(slugs,mode='custom')=>(await query('select public.catalog_quote($1::uuid[],$2) q',[slugs.map(id),mode])).rows[0].q;
 for(const [slugs,total,pct] of [[['mini-scl'],4900,0],[['cerq','feel-e'],12160,5],[['neo-pi-3','cerq','rs-nl'],20615,5],[['feel-e','brief-a','srs-a','spm-2'],24840,10],[['stress-en-emotieprofiel'],27500,0]]){const q=await quote(slugs,slugs[0]==='stress-en-emotieprofiel'?'package':'custom');assert.equal(q.totalCents,total);assert.equal(q.discountPercent,pct);assert.equal(q.items.reduce((s,x)=>s+x.priceCents,0),total);checks++;}
 await rejects(()=>quote(['cerq','cerq']),'invalid_selection');
 await rejects(()=>quote(['cerq','feel-e'],'package'),'invalid_selection');
 await rejects(()=>quote(['stress-en-emotieprofiel']),'unavailable_product');
 const q=await quote(['neo-pi-3','cerq','rs-nl']);const submission=randomUUID();
 const create=async(hash=q.hash,key=submission)=>(await query('select public.create_catalog_order($1,$2::uuid[],$3,$4,$5) id',[customer,q.items.map(x=>x.id),'custom',hash,key])).rows[0].id;
 const order=await create();assert.equal(await create(),order);checks++;
 assert.equal((await query('select sum(price_cents)::int n from public.order_items where order_id=$1',[order])).rows[0].n,q.totalCents);checks++;
 assert.equal((await query('select count(*)::int n from public.assessment_deliveries where customer_user_id=$1',[customer])).rows[0].n,0);checks++;
 await query('update public.products set price_cents=price_cents+100 where id=$1',[id('cerq')]);await rejects(()=>create(q.hash,randomUUID()),'quote_changed');
 await query("update public.catalog_details set availability='paused' where product_id=$1",[id('cerq')]);await rejects(()=>quote(['cerq']),'unavailable_product');
 await query('select public.confirm_wise_manual_payment($1,$2)',[order,admin]);await query('select public.confirm_wise_manual_payment($1,$2)',[order,admin]);
 const deliveries=(await query('select * from public.assessment_deliveries where customer_user_id=$1',[customer])).rows;assert.equal(deliveries.length,3);assert.equal((await query('select count(*)::int n from public.entitlements where customer_user_id=$1',[customer])).rows[0].n,3);checks++;
 await query('select public.update_assessment_delivery($1,$2,$3,$4,$5,$6)',[admin,deliveries[0].id,'invited','Test instructions','https://example.invalid/test',null]);checks++;
 await rejects(()=>query('select public.update_assessment_delivery($1,$2,$3,$4,$5,$6)',[customer,deliveries[0].id,'completed','','',null]),'forbidden');
 const pack=await quote(['stress-en-emotieprofiel'],'package');const po=(await query('select public.create_catalog_order($1,$2::uuid[],$3,$4,$5) id',[customer,[id('stress-en-emotieprofiel')],'package',pack.hash,randomUUID()])).rows[0].id;
 await query("delete from public.catalog_components where package_id=$1",[id('stress-en-emotieprofiel')]);await query('select public.confirm_wise_manual_payment($1,$2)',[po,admin]);assert.equal((await query('select count(*)::int n from public.assessment_deliveries d join public.order_items i on i.id=d.order_item_id where i.order_id=$1',[po])).rows[0].n,7);checks++;
 const half=(await query("update public.products set price_cents=3005 where slug in ('ciss','rs-nl') returning id")).rows.map(x=>x.id);const h=(await query('select public.catalog_quote($1::uuid[],$2) q',[half,'custom'])).rows[0].q;assert.equal(h.totalCents,5710);assert.equal(h.items.reduce((s,x)=>s+x.priceCents,0),5710);checks++;

 const editId=id('mini-scl');const ep=(await query('select * from public.products where id=$1',[editId])).rows[0];const ed=(await query('select * from public.catalog_details where product_id=$1',[editId])).rows[0];
 const edit={id:editId,title:ep.title,slug:'catalog-test-redirect',type:'questionnaire',status:ep.status,summary:ep.summary,priceCents:ep.price_cents,category:ed.category,audience:ed.audience,ageLabel:ed.age_label,version:ed.version,availability:ed.availability,description:ed.description,includesText:ed.includes_text,deliveryText:ed.delivery_text,reviewNote:'Only visible to admin',image:ed.image,sortOrder:ed.sort_order,costCents:123,costNote:'Test cost',components:[]};
 await query('select public.save_catalog_product($1,$2::jsonb)',[admin,JSON.stringify(edit)]);assert.equal((await query('select product_id from public.catalog_slug_aliases where slug=$1',['mini-scl'])).rows[0].product_id,editId);checks++;
 await rejects(()=>query('select public.save_catalog_product($1,$2::jsonb)',[customer,JSON.stringify(edit)]),'forbidden');
 const jobs=(await query('select * from public.claim_commerce_mail(2,$1)',[order])).rows;assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.lease_token&&j.attempts===1));const nextJobs=(await query('select * from public.claim_commerce_mail(2,$1)',[order])).rows;assert.ok(nextJobs.every(j=>!jobs.some(old=>old.id===j.id)));checks++;
 await query('select public.save_catalog_pricing($1,$2::jsonb)',[admin,JSON.stringify({mediumMin:3,mediumPercent:7,largeMin:5,largePercent:12,priceLabel:'Test price'})]);assert.equal((await quote(['neo-pi-3','ciss'])).discountPercent,0);assert.equal((await quote(['neo-pi-3','ciss','rs-nl'])).discountPercent,7);checks++;
 await query('set local role anon');await rejects(()=>query('select * from public.catalog_costs'),'permission denied');await rejects(()=>query('select public.catalog_quote($1::uuid[],$2)',[[id('mini-scl')],'custom']),'permission denied');await rejects(()=>query('select * from public.assessment_deliveries'),'permission denied');await query('reset role');
 const bucket=(await query("select public,file_size_limit from storage.buckets where id='assessment-reports'")).rows[0];assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),15728640);checks++;
 await query('set local role authenticated');await rejects(()=>query('select * from public.catalog_costs'),'permission denied');await rejects(()=>query('select public.save_catalog_product($1,$2::jsonb)',[admin,JSON.stringify(edit)]),'permission denied');await query('reset role');
 console.log(`${checks} database checks passed: pricing, idempotency, changed quotes, availability, snapshots, fulfillment, role restrictions, private storage.`);
}finally{await query('rollback');await client.end();console.log('Transaction rolled back; no test users, orders or deliveries retained.');}
