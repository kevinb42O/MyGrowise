// PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.cjs node tests/ebook-purchase-isolated-db.mjs
// Uses an in-memory PostgreSQL database only. Never connects to Supabase or sends mail.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const order='11111111-1111-4111-8111-111111111111',item='22222222-2222-4222-8222-222222222222',product='33333333-3333-4333-8333-333333333333',actor='44444444-4444-4444-8444-444444444444';
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const fn=(source,start)=>source.slice(source.indexOf(start),source.indexOf('$$;',source.indexOf(start))+3);
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table products(id uuid primary key,type text,metadata jsonb);
 create table orders(id uuid primary key,customer_user_id uuid,status text,provider text,total_cents integer,currency text,provider_reference text,payment_verified_at timestamptz,payment_verified_by uuid,updated_at timestamptz);
 create table order_items(id uuid primary key,order_id uuid references orders,product_id uuid references products,product_title text,product_slug text,product_type text);
 create table entitlements(id uuid primary key default gen_random_uuid(),customer_user_id uuid,order_item_id uuid unique references order_items,product_id uuid,product_title text,product_slug text,product_type text,status text);
 create table security_audit_log(actor_user_id uuid,action text,object_type text,object_id text,metadata jsonb);
 create table commerce_access_tokens(token_hash text primary key,email text,expires_at timestamptz,consumed_at timestamptz);
 create table commerce_sessions(session_hash text primary key,email text,expires_at timestamptz);
 insert into products values('${product}','guide','{"kind":"ebook"}');
 insert into orders(id,status,provider,total_cents,currency,provider_reference) values('${order}','pending_payment','wise_manual',1495,'EUR','TEST-ONLY');
 insert into order_items values('${item}','${order}','${product}','Fien','fien','guide');`);
 const manual=migration('20260924170000_wise_manual_checkout.sql');
 await db.exec(fn(manual,'create or replace function public.confirm_wise_manual_payment('));
 await db.exec(`revoke all on function confirm_wise_manual_payment(uuid,uuid) from public,anon,authenticated;grant execute on function confirm_wise_manual_payment(uuid,uuid) to service_role;`);
 await db.exec(migration('20261109130000_ebook_purchase_access.sql').split('-- A book purchase')[0]);
 await db.exec(fn(migration('20261018173304_commerce_guest_and_website_repair.sql'),'create function public.consume_purchase_token('));
 await assert.rejects(db.query('select ensure_ebook_license($1,$2)',[item,'a'.repeat(64)]),/ebook_unavailable/);
 assert.equal((await db.query('select * from entitlements')).rows.length,0);
 const privileges=(await db.query("select has_function_privilege('anon','confirm_wise_manual_payment(uuid,uuid)','execute') anon,has_function_privilege('authenticated','confirm_wise_manual_payment(uuid,uuid)','execute') customer,has_function_privilege('service_role','confirm_wise_manual_payment(uuid,uuid)','execute') service")).rows[0];
 assert.deepEqual(privileges,{anon:false,customer:false,service:true});

 // Email verification before payment is allowed, but it creates no purchase right.
 await db.query("insert into commerce_access_tokens values($1,'buyer@example.invalid',now()+interval '30 minutes',null)",['b'.repeat(64)]);
 assert.equal((await db.query('select consume_purchase_token($1,$2) ok',['b'.repeat(64),'c'.repeat(64)])).rows[0].ok,true);
 assert.equal((await db.query('select consume_purchase_token($1,$2) ok',['b'.repeat(64),'d'.repeat(64)])).rows[0].ok,false);
 assert.equal((await db.query('select * from entitlements')).rows.length,0);

 // Execute the existing production confirmation function, not a test replacement.
 await db.query('select confirm_wise_manual_payment($1,$2)',[order,actor]);
 const confirmed=(await db.query('select status,payment_verified_at,payment_verified_by from orders where id=$1',[order])).rows[0];
 assert.equal(confirmed.status,'paid');assert.ok(confirmed.payment_verified_at);assert.equal(confirmed.payment_verified_by,actor);
 assert.equal((await db.query("select * from entitlements where status='active'")).rows.length,1);
 await db.query('select confirm_wise_manual_payment($1,$2)',[order,actor]);
 assert.equal((await db.query('select * from entitlements')).rows.length,1,'Repeated confirmation is idempotent');
 assert.equal((await db.query('select * from security_audit_log')).rows.length,1);
 assert.equal((await db.query('select * from ebook_licenses')).rows.length,0,'A paid owner needs no activation license in the new flow');

 // Compatibility: existing codes still redeem once, and remain limited to one book.
 await db.query('select ensure_ebook_license($1,$2)',[item,'a'.repeat(64)]);
 assert.equal((await db.query('select activate_ebook_code($1,$2) slug',['a'.repeat(64),'e'.repeat(64)])).rows[0].slug,'fien');
 assert.equal((await db.query('select activate_ebook_code($1,$2) slug',['a'.repeat(64),'f'.repeat(64)])).rows[0].slug,null);

 const readable=async()=>Number((await db.query(`select count(*) n from entitlements e join order_items i on i.id=e.order_item_id join orders o on o.id=i.order_id where e.product_id=$1 and e.status='active' and o.status in ('paid','fulfilled') and o.provider='wise_manual' and o.payment_verified_at is not null`,[product])).rows[0].n);
 assert.equal(await readable(),1);
 for(const status of ['refunded','cancelled','pending_payment']){
  await db.query('update orders set status=$1 where id=$2',[status,order]);assert.equal(await readable(),0);
  if(status!=='pending_payment')await assert.rejects(db.query('select confirm_wise_manual_payment($1,$2)',[order,actor]),/not awaiting payment/);
 }
 await db.query('select confirm_wise_manual_payment($1,$2)',[order,actor]);
 assert.equal(await readable(),1);
 // A forged paid flag without the recorded manual confirmation is still insufficient.
 await db.query("update orders set status='paid',payment_verified_at=null where id=$1",[order]);assert.equal(await readable(),0);
 await db.query("insert into commerce_access_tokens values($1,'buyer@example.invalid',now()-interval '1 second',null)",['f'.repeat(64)]);
 assert.equal((await db.query('select consume_purchase_token($1,$2) ok',['f'.repeat(64),'a'.repeat(64)])).rows[0].ok,false);
 console.log('Isolated PostgreSQL: manual payment gate, privileges, audit/idempotency, email tokens, legacy codes, refund/cancellation and missing-confirmation denial passed. No external writes or mail.');
}finally{await db.close();}
