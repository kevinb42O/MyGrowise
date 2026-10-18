// Run with dotenv. Default: prepare a review. --apply <review> applies it once.
// --verify <review> performs the same import and rolls the transaction back.
import pg from 'pg';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const entries=JSON.parse(readFileSync(resolve(root,'docs/content/questionnaire-landings.json'),'utf8'));
const digest=createHash('sha256').update(JSON.stringify(entries)).digest('hex');
const [mode,reviewPath]=process.argv.slice(2);
if(mode&&!['--apply','--verify'].includes(mode))throw new Error('Gebruik zonder argumenten voor review, of --apply/--verify <reviewbestand>.');
if(mode&&!reviewPath)throw new Error('Geef het eerder gecontroleerde reviewbestand op.');
if(entries.length!==22||new Set(entries.map(e=>e.slug)).size!==22)throw new Error('Verwacht precies 22 unieke instrumenten.');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
const selection=`select p.id,p.slug,p.title,p.type,p.status,p.summary,p.price_cents,p.updated_at::text as product_updated_at,
 d.category,d.audience,d.age_label,d.version,d.availability,d.description,d.includes_text,d.delivery_text,
 d.landing_content,d.audience_groups,d.updated_at::text as details_updated_at
 from public.products p join public.catalog_details d on d.product_id=p.id
 where p.id=$1 for update of p,d`;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
try{
 await db.connect();await db.query('begin');await db.query("set local lock_timeout='10s'; set local statement_timeout='30s'");
 await db.query('select pg_advisory_xact_lock(104041511)');
 const review=mode?JSON.parse(readFileSync(resolve(reviewPath),'utf8')):null;
 if(review&&(review.sourceDigest!==digest||review.products.length!==22))throw new Error('De bron of de mapping veranderde. Maak opnieuw een review.');
 const products=[];
 for(const entry of entries){
  const matches=await db.query(`select distinct p.id from public.products p left join public.catalog_slug_aliases a on a.product_id=p.id where p.type='questionnaire' and (p.slug=$1 or a.slug=$1)`,[entry.slug]);
  if(matches.rows.length!==1)throw new Error(`${entry.slug}: verwacht één bestaand product, gevonden ${matches.rows.length}.`);
  const current=(await db.query(selection,[matches.rows[0].id])).rows[0];
  if(current.price_cents!==entry.priceCents)throw new Error(`${entry.slug}: prijs wijkt af van de bron; beoordeel vóór import.`);
  const prior=review?.products.find(product=>product.sourceSlug===entry.slug);
  if(review&&(!prior||!same(prior.before,current)))throw new Error(`${entry.slug}: catalogus is sinds de review gewijzigd; import afgebroken.`);
  products.push({sourceSlug:entry.slug,before:current,after:{title:entry.title,summary:entry.summary,age_label:entry.ageLabel,version:entry.instrument,category:entry.category,audience:entry.audience,description:entry.landingContent.introduction.join('\n\n'),includes_text:entry.landingContent.expectations.join('\n\n'),landing_content:entry.landingContent,audience_groups:entry.audienceGroups}});
 }
 if(mode){
  // Write the restore source before mutation; it contains only the affected public fields.
  const out=resolve(root,'output/questionnaires');mkdirSync(out,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const backup=resolve(out,`before-import-${stamp}.json`);
  writeFileSync(backup,JSON.stringify({sourceDigest:digest,products},null,2)+'\n',{flag:'wx'});
  for(const {before,after} of products){
   await db.query('update public.products set title=$2,summary=$3,updated_at=now() where id=$1',[before.id,after.title,after.summary]);
   await db.query(`update public.catalog_details set age_label=$2,version=$3,category=$4,audience=$5,description=$6,includes_text=$7,landing_content=$8::jsonb,audience_groups=$9::text[],updated_at=now() where product_id=$1`,[before.id,after.age_label,after.version,after.category,after.audience,after.description,after.includes_text,JSON.stringify(after.landing_content),after.audience_groups]);
  }
  const {rows}=await db.query('select count(*)::int as count from public.catalog_details where product_id=any($1::uuid[]) and landing_content is not null',[products.map(p=>p.before.id)]);
  if(rows[0].count!==22)throw new Error('De 22 landingspagina’s zijn niet volledig opgeslagen.');
  await db.query(mode==='--apply'?'commit':'rollback');
  console.log(`${mode==='--apply'?'Geïmporteerd':'Gecontroleerd en teruggedraaid'}: 22 landingspagina’s. Prijzen, statussen, slugs, kosten en pakketrelaties behouden. Herstelbron: ${backup}`);
 }else{
  await db.query('rollback');
  const out=resolve(root,'output/questionnaires');mkdirSync(out,{recursive:true});
  const path=resolve(out,`import-review-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  writeFileSync(path,JSON.stringify({sourceDigest:digest,products},null,2)+'\n',{flag:'wx'});
  console.log(`Review van 22 bestaande producten: ${path}`);
  for(const p of products)console.log(`${p.sourceSlug}: ${p.before.age_label} → ${p.after.age_label}; ${p.before.title} → ${p.after.title}`);
 }
}catch(error){await db.query('rollback').catch(()=>{});throw error;}finally{await db.end();}
