// Run against the dedicated dev server with WEBSITE_MAIL_MODE=capture.
// Synthetic addresses/material only. All created records are removed in finally.
import 'dotenv/config';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID,randomBytes,createHash} from 'node:crypto';import {createClient} from '@supabase/supabase-js';import {readFileSync,existsSync} from 'node:fs';
const origin=process.env.COMMERCE_TEST_ORIGIN||'http://localhost:4322';
assert.match(origin,/^http:\/\/localhost:4322$/,'Use the isolated mail-capture dev server');
const service=createClient(process.env.PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});const suffix=randomUUID();const email=`guest-http-${suffix}@example.invalid`,otherEmail=`outsider-http-${suffix}@example.invalid`;const accounts=[],products=[],paths=[],sessionHashes=[],tokenHashes=[];let checks=0;
const testIP=`192.0.2.${parseInt(suffix.slice(0,2),16)%253+1}`;
const secret=()=>randomBytes(32).toString('base64url'),hash=s=>createHash('sha256').update(s).digest('hex');
const request=async(path,{cookie='',form,headers={}}={})=>fetch(origin+path,{method:form?'POST':'GET',redirect:'manual',headers:{'x-forwarded-for':testIP,...(cookie?{cookie}:{}),...(form?{origin}:{}),...headers},...(form?{body:new URLSearchParams(form)}:{})});
const cookies=r=>r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
const status=(r,n)=>{assert.equal(r.status,n);checks++;return r;};
const q=(s,p=[])=>db.query(s,p);
const seedToken=async(address=email,minutes=30)=>{const t=secret();tokenHashes.push(hash(t));await q("insert into public.commerce_access_tokens(token_hash,email,expires_at) values($1,$2,now()+make_interval(mins=>$3))",[hash(t),address,minutes]);return t;};
const activate=async(t,next='/aankopen')=>{const r=status(await request('/api/aankopen/toegang',{form:{token:t,next}}),303);const cookie=cookies(r);const value=cookie.match(/mg_purchase=([^;]+)/)?.[1];if(value)sessionHashes.push(hash(value));return {r,cookie};};
try{
 await db.connect();
 const makeUser=async address=>{const password=`Test-${randomUUID()}-aA1!`;const result=await service.auth.admin.createUser({email:address,password,email_confirm:true});if(result.error)throw result.error;accounts.push(result.data.user.id);const auth=createClient(process.env.PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await auth.auth.signInWithPassword({email:address,password});if(signed.error)throw signed.error;return {id:result.data.user.id,email:address,password,cookie:`mg_session=${signed.data.session.access_token}`};};
 const account=await makeUser(email),outsider=await makeUser(otherEmail);
 const login=status(await request('/api/account/login',{form:{email:account.email,password:account.password,next:'/aankopen'}}),303);assert.equal(login.headers.get('location'),'/aankopen');assert.match(cookies(login),/mg_session=/);checks++;
 const authBefore=(await q('select count(*)::int n from auth.users')).rows[0].n;
 const question=(await q("select id from public.products where slug='cerq'")).rows[0].id;
 const quote=(await q("select public.catalog_quote($1,'custom') v",[[question]])).rows[0].v;
 const checkout=status(await request(`/bestellen?producten=${question}`),200);const html=await checkout.text();assert.ok(html.includes('Bestellen zonder verplicht account.'));assert.ok(html.includes('name="birth_date"'));const checkoutCookie=cookies(checkout);assert.match(checkoutCookie,/mg_checkout=/);assert.match(checkout.headers.getSetCookie().join(' '),/HttpOnly/i);checks++;
 const submission=randomUUID(),form={ids:question,mode:'custom',hash:quote.hash,submission,terms:'accepted',email,first_name:'HTTP',last_name:'Test',birth_date:'1990-01-01',gender:'unspecified',participant:'self'};
 const submitted=status(await request('/api/checkout/catalog-order',{cookie:checkoutCookie,form}),303);const location=submitted.headers.get('location');assert.match(location,/^\/bestellen\?order=/);const order=location.split('order=')[1];
 const repeated=status(await request('/api/checkout/catalog-order',{cookie:checkoutCookie,form}),303);assert.equal(repeated.headers.get('location'),location);checks++;
 assert.equal((await q('select customer_user_id from public.orders where id=$1',[order])).rows[0].customer_user_id,null);assert.equal((await q('select count(*)::int n from auth.users')).rows[0].n,authBefore);checks++;
 const bank=status(await request(location,{cookie:checkoutCookie}),200);assert.ok((await bank.text()).includes('Betaal via overschrijving'));assert.match(bank.headers.get('cache-control'),/no-store/);checks++;
 const hidden=status(await request(location),303);assert.ok(hidden.headers.get('location').startsWith('/aankopen/toegang'));status(await request('/aankopen',{cookie:checkoutCookie}),303);
 status(await request('/api/checkout/catalog-order',{cookie:checkoutCookie,form,headers:{origin:'https://attacker.invalid'}}),403);
 const invalid=status(await request('/api/checkout/catalog-order',{cookie:checkoutCookie,form:{...form,submission:randomUUID(),birth_date:'2026-02-31'}}),400);assert.ok((await invalid.text()).includes('geboortedatum'));checks++;
 const beforeLink=status(await request('/aankopen',{cookie:account.cookie}),200);assert.ok(!(await beforeLink.text()).includes(order));checks++;
 // A mail scanner only reads the page. It cannot consume the token.
 const token=await seedToken();const scanner=status(await request('/aankopen/toegang'),200);assert.ok(!(await scanner.text()).includes(token));assert.equal((await q('select consumed_at from public.commerce_access_tokens where token_hash=$1',[hash(token)])).rows[0].consumed_at,null);checks++;
 const session=await activate(token);assert.match(session.cookie,/mg_purchase=/);assert.match(session.r.headers.getSetCookie().join(' '),/HttpOnly/i);assert.equal(session.r.headers.get('location'),'/aankopen');
 assert.ok((await activate(token)).r.headers.get('location').includes('expired'));assert.ok((await activate(await seedToken(email,-1))).r.headers.get('location').includes('expired'));checks++;
 const external=await activate(await seedToken(), '//attacker.invalid');assert.equal(external.r.headers.get('location'),'/aankopen');checks++;
 const overview=status(await request('/aankopen',{cookie:session.cookie}),200);assert.ok((await overview.text()).includes('Wacht op betaling'));checks++;
 const ownOther=await activate(await seedToken(otherEmail));const otherOverview=status(await request('/aankopen',{cookie:ownOther.cookie}),200);assert.ok(!(await otherOverview.text()).includes(order));checks++;
 await q('select public.confirm_wise_manual_payment($1,$2)',[order,account.id]);
 const delivery=(await q('select d.id from public.assessment_deliveries d join public.order_items i on i.id=d.order_item_id where i.order_id=$1',[order])).rows[0].id;
 await q("update public.assessment_deliveries set instructions='Synthetic instructions',status='invited',external_url='https://example.invalid/assessment' where id=$1",[delivery]);
 const afname=status(await request(`/aankopen/afnames/${delivery}`,{cookie:session.cookie}),200);assert.ok((await afname.text()).includes('Synthetic instructions'));status(await request(`/aankopen/afnames/${delivery}`,{cookie:ownOther.cookie}),404);
 const reportPath=`${(await q('select buyer_id from public.orders where id=$1',[order])).rows[0].buyer_id}/${delivery}/${randomUUID()}.pdf`,reportBytes=Buffer.from('%PDF-1.7\nSynthetic report\n%%EOF');paths.push({bucket:'assessment-reports',path:reportPath});
 const reportUpload=await service.storage.from('assessment-reports').upload(reportPath,reportBytes,{contentType:'application/pdf'});if(reportUpload.error)throw reportUpload.error;await q('update public.assessment_deliveries set report_path=$1 where id=$2',[reportPath,delivery]);
 status(await request(`/api/aankopen/rapport?id=${delivery}`),401);status(await request(`/api/aankopen/rapport?id=${delivery}`,{cookie:ownOther.cookie}),404);const report=status(await request(`/api/aankopen/rapport?id=${delivery}`,{cookie:session.cookie}),303);assert.deepEqual(Buffer.from(await (await fetch(report.headers.get('location'))).arrayBuffer()),reportBytes);checks++;
 await q("update public.orders set status='refunded' where id=$1",[order]);status(await request(`/api/aankopen/rapport?id=${delivery}`,{cookie:session.cookie}),404);await q("update public.orders set status='paid' where id=$1",[order]);
 // Private PDF and audio extras use the same paid owner boundary as a core module.
 for(const format of ['pdf','audio']){
  const product=randomUUID(),release=randomUUID(),asset=randomUUID(),track=randomUUID(),slug=`http-${format}-${suffix}`,objectPath=`${product}/${release}/${asset}.${format==='pdf'?'pdf':'mp3'}`;products.push(product);paths.push({bucket:'module-materials',path:objectPath});
  const bytes=format==='pdf'?Buffer.from('%PDF-1.7\nSynthetic private HTTP test PDF\n%%EOF'):Buffer.concat([Buffer.from('ID3'),Buffer.alloc(197)]);
  await q("insert into public.products(id,slug,title,type,status,summary,price_cents) values($1,$2,$3,'guide','draft','Synthetic test content only',1200)",[product,slug,`Synthetic ${format}`]);
  await q("insert into public.catalog_details(product_id,availability) values($1,'upcoming')",[product]);await q("insert into public.module_details(product_id,number,format,series,audience_text,access_text,support_text) values($1,0,$2,$3,'Test','Test','Test')",[product,format,slug]);
  await q("insert into public.module_releases(id,product_id) values($1,$2)",[release,product]);if(format==='audio')await q("insert into public.module_tracks(id,product_id,key) values($1,$2,'exercise')",[track,product]);
  await q("insert into public.module_assets(id,product_id,release_id,kind,track_id,title,sort_order,object_path,mime,byte_size,status) values($1,$2,$3,$4,$5,'Synthetic file',1,$6,$7,$8,'verified')",[asset,product,release,format,format==='audio'?track:null,objectPath,format==='pdf'?'application/pdf':'audio/mpeg',bytes.length]);
  await q("update public.module_releases set status='published',published_at=now() where id=$1",[release]);await q('update public.module_details set current_release_id=$1 where product_id=$2',[release,product]);
  const upload=await service.storage.from('module-materials').upload(objectPath,bytes,{contentType:format==='pdf'?'application/pdf':'audio/mpeg'});if(upload.error)throw upload.error;
  const buyer=(await q('select buyer_id from public.orders where id=$1',[order])).rows[0].buyer_id;const extraOrder=randomUUID(),item=randomUUID();
  await q("insert into public.orders(id,buyer_id,status,total_cents,currency,provider) values($1,$2,'pending_payment',1200,'EUR','commerce_http')",[extraOrder,buyer]);await q("insert into public.order_items(id,order_id,product_id,product_title,product_slug,product_type,price_cents) values($1,$2,$3,$4,$5,'guide',1200)",[item,extraOrder,product,`Synthetic ${format}`,slug]);
  status(await request(`/api/aankopen/material/${product}${format==='audio'?'?audio=exercise':''}`,{cookie:session.cookie}),404);
  await q("update public.orders set status='paid' where id=$1",[extraOrder]);await q("insert into public.entitlements(buyer_id,order_item_id,product_id,product_title,product_slug,product_type) values($1,$2,$3,$4,$5,'guide')",[buyer,item,product,`Synthetic ${format}`,slug]);
  status(await request(`/aankopen/modules/${slug}`,{cookie:session.cookie}),200);
  const materialPath=`/api/aankopen/material/${product}${format==='audio'?'?audio=exercise':''}`;
  status(await request(materialPath),401);status(await request(materialPath,{cookie:ownOther.cookie}),404);
  const material=status(await request(materialPath,{cookie:session.cookie}),format==='audio'?200:303);const url=format==='audio'?(await material.json()).url:material.headers.get('location');const file=await fetch(url,{headers:format==='audio'?{Range:'bytes=0-63'}:{}});assert.equal(file.status,format==='audio'?206:200);assert.equal((await file.arrayBuffer()).byteLength,format==='audio'?64:bytes.length);checks++;
  if(format==='audio'){const legacy=status(await request(`/account/modules/${slug}/audio/exercise`),303);assert.equal(legacy.headers.get('location'),`/aankopen/modules/${slug}/audio/exercise`);status(await request(legacy.headers.get('location'),{cookie:session.cookie}),200);checks++;}
  for(const revoked of ['refunded','cancelled']){await q('update public.orders set status=$1 where id=$2',[revoked,extraOrder]);status(await request(materialPath,{cookie:session.cookie}),404);}await q("update public.orders set status='paid' where id=$1",[extraOrder]);
 }
 status(await request('/api/aankopen/koppelen',{cookie:session.cookie,form:{}}),403);
 const wrong=status(await request('/api/aankopen/koppelen',{cookie:session.cookie+'; '+outsider.cookie,form:{}}),303);assert.ok(wrong.headers.get('location').includes('error=link'));checks++;
 for(let i=0;i<2;i++){const linked=status(await request('/api/aankopen/koppelen',{cookie:session.cookie+'; '+account.cookie,form:{}}),303);assert.equal(linked.headers.get('location'),'/account/bibliotheek');}
 assert.equal((await q('select customer_user_id from public.orders where id=$1',[order])).rows[0].customer_user_id,account.id);status(await request('/aankopen',{cookie:account.cookie}),200);status(await request(`/aankopen/modules/http-pdf-${suffix}`,{cookie:account.cookie}),200);
 await q('update public.commerce_buyers set email=$1 where customer_user_id=$2',[otherEmail,account.id]);
 const unchangedContact=status(await request('/aankopen',{cookie:session.cookie}),200);assert.ok((await unchangedContact.text()).includes(order));const changedBuyer=status(await request('/aankopen',{cookie:ownOther.cookie}),200);assert.ok(!(await changedBuyer.text()).includes(order));status(await request(`/bestellen?order=${order}`,{cookie:ownOther.cookie}),303);await q('update public.commerce_buyers set email=$1 where customer_user_id=$2',[email,account.id]);checks++;
 const supportBefore=(await q('select count(*)::int n from public.support_conversations')).rows[0].n;
 const contactKey=randomUUID(),contact={name:'HTTP Test',email,category:'Module',body:`Synthetic practical question ${suffix}`,submission_key:contactKey};
 for(const cookie of ['',account.cookie])status(await request('/api/contact',{cookie,form:contact}),303);
 const jobs=(await q('select status,payload from public.website_mail_jobs where submission_key=$1',[contactKey])).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].status,'sent');assert.equal((await q('select count(*)::int n from public.support_conversations')).rows[0].n,supportBefore);checks++;
 const messages=readFileSync('output/mail-test/messages.jsonl','utf8').trim().split('\n').map(JSON.parse);const contactMessage=messages.find(m=>m.replyTo===email&&m.subject==='Contactvraag: Module');assert.ok(contactMessage);assert.equal(contactMessage.to,'info@mygrowise.be');assert.match(contactMessage.mime,/Reply-To:/);assert.ok(!contactMessage.mime.includes('/berichten/gesprek'));checks++;
 const confirmation=messages.find(m=>m.to===email&&m.subject.startsWith('Je bestelling'));assert.ok(confirmation);assert.ok(confirmation.mime.includes('/aankopen/toegang#token='));assert.ok(!confirmation.mime.includes('/account/aanmaken'));checks++;
 const closed=status(await request('/api/aankopen/afsluiten',{cookie:ownOther.cookie,form:{}}),303);assert.equal(closed.headers.get('location'),'/aankopen/toegang');status(await request('/aankopen',{cookie:ownOther.cookie}),303);
 const known=status(await request('/api/aankopen/aanvragen',{form:{email}}),303),unknown=status(await request('/api/aankopen/aanvragen',{form:{email:`unknown-${suffix}@example.invalid`}}),303);assert.equal(known.headers.get('location'),unknown.headers.get('location'));checks++;
 status(await fetch(origin+'/api/analytics',{method:'POST',headers:{origin,cookie:'mg_analytics_consent=granted','content-type':'application/json'},body:JSON.stringify({event:'page_view',path:'/aankopen/toegang'})}),400);
 for(let n=0;n<30;n++){const pending=await q("select count(*)::int n from public.website_mail_jobs where payload->>'email' in ($1,$2) and status in ('pending','sending')",[email,`unknown-${suffix}@example.invalid`]);if(!pending.rows[0].n)break;await new Promise(resolve=>setTimeout(resolve,100));}
 console.log(`${checks} HTTP checks passed: guest checkout, bank privacy, no Auth creation, tokens/replay/expiry, owner isolation, PDF/audio bytes and Range, refunds, optional account linking, captured MIME/contact and neutral recovery.`);
}finally{
 // Let request-scoped background access mail finish before removing its fixtures.
 await q("delete from public.website_mail_jobs where payload->>'email' in ($1,$2,$3)",[email,otherEmail,`unknown-${suffix}@example.invalid`]).catch(()=>{});
 for(const {bucket,path} of paths){const r=await service.storage.from(bucket).remove([path]);if(r.error)console.error('Storage cleanup failed:',r.error.message);}
 if(db._connected){await q('begin');try{
  const owned=(await q('select id from public.commerce_buyers where email in ($1,$2)',[email,otherEmail])).rows.map(b=>b.id);
  if(owned.length){await q('delete from public.assessment_deliveries where buyer_id=any($1)',[owned]);await q('delete from public.entitlements where buyer_id=any($1)',[owned]);await q('delete from public.order_items where order_id in(select id from public.orders where buyer_id=any($1))',[owned]);await q('delete from public.orders where buyer_id=any($1)',[owned]);await q('delete from public.commerce_buyers where id=any($1)',[owned]);}
  if(products.length){await q('delete from public.module_assets where product_id=any($1)',[products]);await q('update public.module_details set current_release_id=null where product_id=any($1)',[products]);await q('delete from public.module_releases where product_id=any($1)',[products]);await q('delete from public.module_tracks where product_id=any($1)',[products]);await q('delete from public.module_details where product_id=any($1)',[products]);await q('delete from public.catalog_details where product_id=any($1)',[products]);await q('delete from public.products where id=any($1)',[products]);}
  await q('delete from public.commerce_access_tokens where email in ($1,$2)',[email,otherEmail]);await q('delete from public.commerce_sessions where email in ($1,$2)',[email,otherEmail]);await q('delete from public.security_audit_log where actor_user_id=any($1)',[accounts]);await q("delete from public.support_rate_limits where key_hash=any($1)",[[...['checkout-email','contact-email','purchase-access-email'].flatMap(kind=>[email,otherEmail,`unknown-${suffix}@example.invalid`].map(value=>hash(kind+':'+value))),...['checkout-ip','contact-ip','purchase-access-ip','purchase-consume'].map(kind=>hash(kind+':'+testIP))]]);await q('commit');
 }catch(e){await q('rollback');console.error('Database cleanup failed:',e.message);}}
 for(const id of accounts){const result=await service.auth.admin.deleteUser(id);if(result.error)console.error('Account cleanup failed:',result.error.message);}
 await db.end();console.log('Synthetic fixtures cleaned up; MIME captured locally, no real mail sent.');
}
