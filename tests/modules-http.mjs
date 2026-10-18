// Isolated HTTP + private Storage smoke test. Uses an unpublished temporary product,
// synthetic material and temporary Auth accounts. Never sends mail or submits a payment.
import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {createClient} from '@supabase/supabase-js';import {Upload} from 'tus-js-client';
const origin=process.env.MODULE_TEST_ORIGIN||'http://localhost:4321';
const service=createClient(process.env.PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});const suffix=randomUUID();const product=randomUUID();const slug=`module-smoke-${suffix}`;const accounts=[];const objectPaths=[];let supplement=null;let checks=0;
const request=async(path,cookie,body)=>fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{...(cookie?{cookie}:{}),...(body!==undefined?{origin,'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
const post=async(action,cookie,body={})=>{const r=await request(`/api/admin/modules/${product}/${action}`,cookie,body);const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));checks++;return data;};
const get=async(path,cookie,status=200)=>{const r=await request(path,cookie);assert.equal(r.status,status,`${path}: ${r.status}`);checks++;return r;};
try{
 await db.connect();
 const makeUser=async role=>{const email=`module-smoke-${role}-${suffix}@example.invalid`;const password=`Smoke-${randomUUID()}-aA1!`;const {data,error}=await service.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;accounts.push(data.user.id);if(role==='admin'){await db.query('delete from public.user_roles where user_id=$1',[data.user.id]);await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[data.user.id]);}const auth=createClient(process.env.PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const result=await auth.auth.signInWithPassword({email,password});if(result.error)throw result.error;return {id:data.user.id,cookie:`mg_session=${result.data.session.access_token}`};};
 const admin=await makeUser('admin'),customer=await makeUser('customer'),other=await makeUser('other');
 await db.query("insert into public.products(id,title,slug,type,status,summary,price_cents,currency) values($1,'Module smoke test',$2,'module','draft','Temporary isolated module delivery verification.',8900,'EUR')",[product,slug]);
 await db.query("insert into public.catalog_details(product_id,availability) values($1,'upcoming')",[product]);await db.query("insert into public.module_details(product_id,series,number) values($1,$2,1)",[product,`test-${suffix}`]);
 const created=await fetch(origin+'/admin/modules/nieuw',{method:'POST',redirect:'manual',headers:{origin,cookie:admin.cookie},body:new URLSearchParams({title:'Supplement smoke test',slug:`supplement-${suffix}`,format:'pdf'})});assert.equal(created.status,303);supplement=created.headers.get('location').split('/').at(-1);checks++;
 const supplementEditor=await (await get(`/admin/modules/${supplement}`,admin.cookie)).text();const priceInput=supplementEditor.match(/<input[^>]*name="price"[^>]*>/)?.[0];assert.ok(priceInput);assert.doesNotMatch(priceInput,/value="[^"]+/);checks++;
 const savedSupplement=await request(`/api/admin/modules/${supplement}/save`,admin.cookie,{revision:1,title:'Supplement smoke test',slug:`supplement-${suffix}`,summary:'Temporary supplemental draft without a confirmed price.',status:'draft',availability:'upcoming',price:'',image:'/images/editorial/mygrowise-50.jpg',subtitle:'',tagline:'',introduction:'',topics:'',audienceText:'',accessText:'',supportText:'',imageAlt:''});assert.equal(savedSupplement.status,200,await savedSupplement.text());assert.equal((await db.query('select price_cents from public.products where id=$1',[supplement])).rows[0].price_cents,null);checks++;
 const html=await (await get(`/admin/modules/${product}`,admin.cookie)).text();assert.ok(html.includes('data-module-editor'));checks++;
 await get(`/api/admin/modules/${product}/material`,customer.cookie,403);
 const moduleEdit={revision:1,title:'Module smoke test',slug,summary:'Temporary isolated module delivery verification.',status:'draft',availability:'upcoming',price:'89.00',image:'/images/editorial/mygrowise-74.jpg',subtitle:'Testinhoud',tagline:'Test',introduction:'Een tijdelijke inleidende alinea.',topics:'Testonderwerp',audienceText:'Tijdelijke testdoelgroep',accessText:'Tijdelijke testtoegang',supportText:'Zelfstudie voor een technische proef',imageAlt:''};
 await post('save',admin.cookie,moduleEdit);
 const stale=await request(`/api/admin/modules/${product}/save`,admin.cookie,moduleEdit);assert.equal(stale.status,409);checks++;
 const denied=await request(`/api/admin/modules/${product}/save`,customer.cookie,{...moduleEdit,revision:2});assert.equal(denied.status,403);checks++;
 assert.equal((await db.query('select subtitle from public.module_details where product_id=$1',[product])).rows[0].subtitle,'Testinhoud');checks++;

 await post('recommendations',admin.cookie,{revision:2,targets:[supplement]});assert.equal((await db.query('select target_product_id from public.module_recommendations where module_product_id=$1',[product])).rows[0].target_product_id,supplement);checks++;
 await post('draft',admin.cookie);
 const release=(await db.query("select id from public.module_releases where product_id=$1 and status='draft'",[product])).rows[0].id;
 const revision=async()=>(await db.query('select revision from public.module_releases where id=$1',[release])).rows[0].revision;
 const upload=async(kind,bytes,key='exercise')=>{
  const info=await post('uploads/start',admin.cookie,{kind,title:kind==='pdf'?'Smoke werkboek':'Smoke audio',key,size:bytes.length,sortOrder:1,revision:await revision()});objectPaths.push(info.path);
  // Use the same signed, resumable transport as the browser; bytes bypass the application server.
  await new Promise((resolve,reject)=>{new Upload(bytes,{endpoint:info.endpoint,headers:{'x-signature':info.token,apikey:info.publishableKey},chunkSize:6*1024*1024,retryDelays:[0,1000],metadata:{bucketName:info.bucket,objectName:info.path,contentType:info.mime},onError:e=>reject(new Error(`Resumable upload failed with HTTP ${e.originalResponse?.getStatus?.()??'unknown'}`)),onSuccess:resolve}).start();});checks++;
  const complete=await request(`/api/admin/modules/${product}/uploads/complete`,admin.cookie,{asset:info.asset});
  return {info,complete};
 };
 const pdfBytes=Buffer.from('%PDF-1.4\n% Synthetic smoke test; not customer material.\n%%EOF\n');
 const pdf=await upload('pdf',pdfBytes);const pdfResult=await pdf.complete.json();assert.equal(pdf.complete.status,200,JSON.stringify(pdfResult));checks++;
 // MPEG frames for transport checks only; real clinical audio is not part of this test.
 const audioBytes=Buffer.alloc(417*4);for(let i=0;i<4;i++)audioBytes.set([255,251,144,0],417*i);
 const audio=await upload('audio',audioBytes);const audioResult=await audio.complete.json();assert.equal(audio.complete.status,200,JSON.stringify(audioResult));checks++;
 const preview=await (await get(`/admin/modules/${product}/preview?release=${release}`,admin.cookie)).text();assert.ok(preview.includes('Smoke audio'));checks++;
 const incomplete=await request(`/api/admin/modules/${product}/publish`,admin.cookie,{release,revision:await revision(),checked:false});assert.equal(incomplete.status,400);checks++;
 await post('publish',admin.cookie,{release,revision:await revision(),checked:true});
 // Fixture access, without a commercial order or any mail event.
 const order=randomUUID(),item=randomUUID();
 await db.query("insert into public.orders(id,customer_user_id,status,total_cents,currency,provider) values($1,$2,'paid',8900,'EUR','module_smoke')",[order,customer.id]);
 await db.query("insert into public.order_items(id,order_id,product_id,product_title,product_slug,product_type,price_cents) values($1,$2,$3,'Module smoke test',$4,'module',8900)",[item,order,product,slug]);
 await db.query("insert into public.entitlements(customer_user_id,order_item_id,product_id,product_title,product_slug,product_type,status) values($1,$2,$3,'Module smoke test',$4,'module','active')",[customer.id,item,product,slug]);
 await get(`/account/modules/${slug}`,customer.cookie);
 const listen=await (await get(`/account/modules/${slug}/audio/exercise`,customer.cookie)).text();assert.ok(listen.includes('data-module-player'));checks++;
 const location=await get(`/account/modules/${slug}/audio/exercise`,null,303);assert.equal(location.headers.get('location'),`/aankopen/modules/${slug}/audio/exercise`);checks++;
 const material=await get(`/api/account/modules/${product}/werkboek`,customer.cookie,303);const content=await fetch(material.headers.get('location'));assert.equal(content.status,200);assert.deepEqual(Buffer.from(await content.arrayBuffer()),pdfBytes);checks++;
 const stream=await (await get(`/api/account/modules/${product}/audio/exercise`,customer.cookie)).json();const range=await fetch(stream.url,{headers:{Range:'bytes=0-63'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,64);checks++;
 await get(`/api/account/modules/${product}/audio/exercise`,other.cookie,404);await get(`/api/account/modules/${product}/werkboek`,other.cookie,404);await get(`/api/account/modules/${product}/audio/wrong-key`,customer.cookie,404);
 const publicUrl=`${process.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/module-materials/${pdf.info.path}`;assert.ok((await fetch(publicUrl)).status>=400);checks++;
 await db.query("update public.entitlements set status='revoked',revoked_at=now() where product_id=$1",[product]);await get(`/api/account/modules/${product}/werkboek`,customer.cookie,404);
 console.log(`${checks} HTTP/Storage checks passed: admin rendering, signed resumable upload, byte validation, publication, preview, workbook bytes, audio Range, login return and purchase isolation.`);
}finally{
 if(objectPaths.length){const removed=await service.storage.from('module-materials').remove(objectPaths);if(removed.error)console.error('Temporary storage cleanup failed:',removed.error.message);}
 if(db._connected){
  await db.query('begin');try{
   await db.query('delete from public.entitlements where product_id=$1',[product]);await db.query('delete from public.order_items where product_id=$1',[product]);
   await db.query("delete from public.orders where provider='module_smoke' and customer_user_id=any($1::uuid[])",[accounts]);
   await db.query('delete from public.commerce_buyers where customer_user_id=any($1::uuid[])',[accounts]);
   await db.query('delete from public.security_audit_log where actor_user_id=any($1::uuid[])',[accounts]);
   await db.query('delete from public.module_recommendations where module_product_id=$1 or target_product_id=$2',[product,supplement]);if(supplement){await db.query('delete from public.module_details where product_id=$1',[supplement]);await db.query('delete from public.catalog_details where product_id=$1',[supplement]);await db.query('delete from public.products where id=$1',[supplement]);}
   await db.query('delete from public.module_assets where product_id=$1',[product]);await db.query('update public.module_details set current_release_id=null where product_id=$1',[product]);await db.query('delete from public.module_releases where product_id=$1',[product]);await db.query('delete from public.module_tracks where product_id=$1',[product]);await db.query('delete from public.module_details where product_id=$1',[product]);await db.query('delete from public.catalog_details where product_id=$1',[product]);await db.query('delete from public.products where id=$1',[product]);await db.query('commit');
  }catch(e){await db.query('rollback');console.error('Temporary database cleanup failed:',e.message);}
 }
 for(const id of accounts){const result=await service.auth.admin.deleteUser(id);if(result.error)console.error('Temporary account cleanup failed:',result.error.message);}
 await db.end();console.log('Temporary product, material, access and accounts cleaned up.');
}
