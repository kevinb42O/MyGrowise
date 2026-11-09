// Rehearse against localhost:4322. Only synthetic orders and sessions are created.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const origin = 'http://localhost:4322';
const slug = 'jij-fien-en-een-toverkist-vol-superkrachten';
const email = `ebook-qa-${randomUUID()}@example.invalid`;
const code = 'FIEN-ABCD-EFGH-JKLM-NPQR-STUV';
const hash = value => createHash('sha256').update(value).digest('hex');
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const query = (sql, params = []) => client.query(sql, params);
const request = (path, {cookie, form} = {}) => fetch(origin + path, {
  method: form ? 'POST' : 'GET',
  redirect: 'manual',
  headers: { ...(cookie ? {cookie} : {}), ...(form ? {origin, 'x-forwarded-for':'192.0.2.191'} : {}) },
  body: form && new URLSearchParams(form),
});
let orderId;
await client.connect();
try {
  const {rows:[book]} = await query('select id,status from public.products where slug=$1',[slug]);
  assert.ok(book);
  const {rows:[actor]} = await query("select user_id from public.user_roles where role='super_admin' limit 1");
  await query('begin');
  // Temporarily enable quoting inside this transaction only.
  await query("update public.products set status='published' where id=$1",[book.id]);
  await query("update public.catalog_details set availability='available' where product_id=$1",[book.id]);
  const {rows:[{quote}]} = await query("select public.catalog_quote($1,'custom') quote",[[book.id]]);
  assert.equal(quote.totalCents,1495);
  const contact = {email,first_name:'Fien',last_name:'Test',birth_date:null,gender:'unspecified',participant:'self'};
  const {rows:[order]} = await query(
    "select public.create_guest_catalog_order($1,$2,'custom',$3,$4,$5) id",
    [hash(randomBytes(32)),[book.id],quote.hash,randomUUID(),contact],
  );
  orderId=order.id;
  const {rows:[item]} = await query('select id from public.order_items where order_id=$1',[orderId]);
  const codeHash=hash(code.replaceAll('-',''));
  await query('savepoint check_unpaid');
  await assert.rejects(query('select public.ensure_ebook_license($1,$2)',[item.id,codeHash]),/ebook_unavailable/);
  await query('rollback to savepoint check_unpaid');
  await query('select public.confirm_wise_manual_payment($1,$2)',[orderId,actor.user_id]);
  // Keep these synthetic messages from the production mail worker.
  await query("update public.commerce_mail_jobs set next_attempt_at='infinity' where order_id=$1",[orderId]);
  await query('select public.ensure_ebook_license($1,$2)',[item.id,codeHash]);
  await query('select public.ensure_ebook_license($1,$2)',[item.id,codeHash]);
  await query('update public.products set status=$2 where id=$1',[book.id,book.status]);
  if(book.status==='draft')await query("update public.catalog_details set availability='upcoming' where product_id=$1",[book.id]);
  await query('commit');

  const recoveryToken=randomBytes(32).toString('base64url');
  await query("insert into public.commerce_access_tokens(token_hash,email,expires_at) values($1,$2,now()+interval '5 minutes')",[hash(recoveryToken),email]);
  const recovery=await request('/api/aankopen/toegang',{form:{token:recoveryToken}});
  assert.equal(recovery.status,303);
  const recoveryCookie=recovery.headers.getSetCookie().find(value=>value.startsWith('mg_purchase=')).split(';')[0];

  assert.equal((await request('/api/boeken/download/pdf')).status,401);
  assert.equal((await request('/api/boeken/download/pdf',{cookie:recoveryCookie})).status,404);
  assert.equal((await request(`/api/aankopen/material/${book.id}?download=1`,{cookie:recoveryCookie})).status,404);
  const attempts=await Promise.all([1,2].map(()=>request('/api/boeken/activeren',{form:{code}})));
  const accepted=attempts.filter(r=>r.headers.get('location')===`/aankopen/boeken/${slug}`);
  assert.equal(accepted.length,1);
  assert.equal(attempts.filter(r=>r.headers.get('location')==='/boeken/activeren?error=code').length,1);
  const cookieHeader=accepted[0].headers.getSetCookie().find(value=>value.startsWith('mg_ebook='));
  assert.match(cookieHeader,/HttpOnly/i);
  const cookie=cookieHeader.split(';')[0];
  assert.equal((await request('/aankopen',{cookie})).headers.get('location'),'/aankopen/toegang');
  const library=await request(`/aankopen/boeken/${slug}`,{cookie});
  assert.equal(library.status,200);
  assert.match(await library.text(),/Download EPUB/);
  for(const [format,magic] of [['pdf','%PDF-'],['epub','PK']]){
    const download=await request(`/api/boeken/download/${format}`,{cookie});
    assert.equal(download.status,303);
    assert.match(download.headers.get('cache-control'),/no-store/);
    const file=await fetch(download.headers.get('location'),{headers:{Range:'bytes=0-31'}});
    assert.equal(file.status,206);
    assert.ok(Buffer.from(await file.arrayBuffer()).toString().startsWith(magic));
  }
  assert.equal((await request('/api/boeken/download/pdf',{cookie:recoveryCookie})).status,303);
  await query("update public.orders set status='refunded' where id=$1",[orderId]);
  assert.equal((await request('/api/boeken/download/pdf',{cookie})).status,401);
  assert.equal((await request('/api/boeken/download/pdf',{cookie:recoveryCookie})).status,404);
  console.log('E-book checks passed: €14.95 quote, checkout without birth date, payment gate, concurrent one-time redemption, book-only session, PDF/EPUB, email recovery and refund revocation.');
} finally {
  await query('rollback').catch(()=>{});
  if(orderId){
    await query("delete from public.security_audit_log where object_type='order' and object_id=$1",[orderId]);
    await query('delete from public.entitlements where order_item_id in(select id from public.order_items where order_id=$1)',[orderId]);
    await query('delete from public.order_items where order_id=$1',[orderId]);
    await query('delete from public.orders where id=$1',[orderId]);
  }
  await query('delete from public.commerce_buyers where email=$1',[email]);
  await query('delete from public.commerce_access_tokens where email=$1',[email]);
  await query('delete from public.commerce_sessions where email=$1',[email]);
  await query('delete from public.support_rate_limits where key_hash=any($1)',[[hash('ebook-activate:192.0.2.191'),hash('purchase-consume:192.0.2.191')]]);
  await client.end();
}
