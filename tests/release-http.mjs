// Real HTTP rendering and authorization with synthetic, disposable fixtures; no mail or payment actions.
import 'dotenv/config';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';import {createClient} from '@supabase/supabase-js';
const origin=process.env.MODULE_TEST_ORIGIN||'http://localhost:4322',db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
const service=createClient(process.env.PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const accounts=[],products=[];let pageId;let checks=0;
const request=(path,cookie='',form,requestOrigin=origin)=>fetch(origin+path,{method:form?'POST':'GET',redirect:'manual',headers:{...(cookie?{cookie}:{}),...(form?{origin:requestOrigin}: {})},...(form?{body:form}: {})});
const check=async(path,cookie='',status=200)=>{const r=await request(path,cookie);assert.equal(r.status,status,path);checks++;return r;};
try{
 await db.connect();
 const user=async(role)=>{const email=`release-${randomUUID()}@example.invalid`,password=`Test-${randomUUID()}-aA1!`;const {data,error}=await service.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;accounts.push(data.user.id);if(role==='super_admin'){await db.query('delete from public.user_roles where user_id=$1',[data.user.id]);await db.query("insert into public.user_roles(user_id,role) values($1,'super_admin')",[data.user.id]);}const signed=await service.auth.signInWithPassword({email,password});if(signed.error)throw signed.error;return `mg_session=${signed.data.session.access_token}`;};
 const admin=await user('super_admin'),customer=await user('customer');
 await check('/admin/mail',admin);await check('/admin/mail',customer,303);await check('/admin/profielen',admin,303);
 for(const [cookie,requestOrigin] of [[customer,origin],[admin,'https://untrusted.example.invalid']]){const response=await request('/api/admin/mail',cookie,new URLSearchParams(),requestOrigin);assert.equal(response.status,403);checks++;}
 const content=JSON.parse(readFileSync('docs/content/profile-landings.json','utf8'));
 for(const e of content){const html=await(await check('/profielen/'+e.slug)).text();assert.ok(html.includes('Belangrijk om te weten'));assert.ok(html.includes(e.content.disclaimer));assert.equal((html.match(/<h1[\s>]/g)||[]).length,1);checks++;}
 const question=(await db.query("select id from public.products where type='questionnaire' and status='published' limit 1")).rows[0].id;
 const c=content[0].content,form=new URLSearchParams({title:'Temporary release profile',slug:`release-${randomUUID()}`,type:'profile',status:'draft',availability:'paused',price:'125.00',summary:'Synthetic profile for an isolated HTTP round trip.',sortOrder:'999',image:'/images/editorial/mygrowise-50.jpg',component:question,[`label-${question}`]:'Test question',[`order-${question}`]:'0',profileFieldsPresent:'1'});
 for(const [key,value] of Object.entries(c)){if(key==='themes')value.forEach(t=>form.append('profile-theme',t));else if(key!=='schemaVersion')form.set('profile-'+key,Array.isArray(value)?value.join('\n'):value===null?'':String(value));}
 const saved=await request('/api/admin/catalog/save',admin,form);assert.equal(saved.status,303,await saved.text());const id=saved.headers.get('location').match(/vragenlijsten\/([a-f0-9-]+)/)[1];products.push(id);checks++;
 assert.deepEqual((await db.query('select profile_landing from public.catalog_details where product_id=$1',[id])).rows[0].profile_landing,c);checks++;
 const editor=await(await check(`/admin/vragenlijsten/${id}`,admin)).text();assert.ok(editor.includes('Landingspagina voor een profiel'));assert.ok(editor.includes('profile-instrumentLines'));checks++;
 const slug=`release-page-${randomUUID()}`;
 const pageForm=new URLSearchParams({kind:'page',status:'published',title:'Synthetic page',slug,excerpt:'A temporary rendering check.',body:'Escaped content <script> is plain text.'});
 const created=await request('/api/admin/content',admin,pageForm);assert.equal(created.status,303);pageId=(await db.query('select id from public.content_items where slug=$1',[slug])).rows[0]?.id;assert.ok(pageId,created.headers.get('location'));checks++;

 const html=await(await check('/'+slug)).text();assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script> is plain text'));checks++;
 await check('/does-not-exist-'+randomUUID(),' ',404);
 const sitemap=await(await check('/sitemap.xml')).text();assert.ok(sitemap.includes('/profielen/prikkelverwerkingsprofiel'));assert.ok(!sitemap.includes('/admin/'));assert.ok(!sitemap.includes('/bestellen'));assert.ok(!sitemap.includes('/voorwaarden'));checks++;
 assert.ok((await(await check('/robots.txt')).text()).includes('Disallow: /aankopen'));checks++;
 for(const [path,target] of [['/nl/onlinebegeleiding/','/begeleiding'],['/nl/stress-en-emotieprofiel/','/profielen/stress-en-emotieprofiel']]){const r=await check(path,'',301);assert.equal(new URL(r.headers.get('location'),origin).pathname,target);checks++;}
 await check('/p/fraaie-fles/','',410);
 console.log(`${checks} release HTTP checks passed: all profile pages, profile editor round trip, mail permissions, published CMS page, escaped text, sitemap, robots, redirects and retired demos.`);
}finally{
 if(pageId)await db.query('delete from public.content_items where id=$1',[pageId]);
 for(const id of products)await db.query('delete from public.products where id=$1',[id]);
 if(accounts.length)await db.query('delete from public.security_audit_log where actor_user_id=any($1::uuid[])',[accounts]);
 for(const id of accounts){const result=await service.auth.admin.deleteUser(id);if(result.error)throw result.error;}
 await db.end();console.log('Synthetic users, profile and CMS page removed; no mail sent.');
}
