// PGLITE_MODULE=/path/to/pglite/dist/index.cjs node tests/client-search-isolated-db.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const actor = '11111111-1111-4111-8111-111111111111';
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table patients(id uuid primary key,full_name text,email text,status text);
    create table patient_recent_visits(user_id uuid,patient_id uuid,visited_at timestamptz);
    create function patient_actor_can_access(uuid,uuid) returns boolean language sql as $$ select $2 <> '99999999-9999-4999-8999-999999999999'::uuid $$;
    create function patient_search_text(text) returns text language sql immutable as $$ select translate(lower(coalesce($1,'')),'áàäâãåéèëêíìïîóòöôõúùüûçñ','aaaaaaeeeeiiiiooooouuuucn') $$;
    insert into patients values
    ('22222222-2222-4222-8222-222222222222','Zoë Paarden','zoe@example.invalid','active'),
    ('33333333-3333-4333-8333-333333333333','Paarden','exact@example.invalid','active'),
    ('44444444-4444-4444-8444-444444444444','A Paardenstal','prefix@example.invalid','active'),
    ('55555555-5555-4555-8555-555555555555','A Renpaarden','partial@example.invalid','active'),
    ('66666666-6666-4666-8666-666666666666','Paarden Archief','archive@example.invalid','archived'),
    ('99999999-9999-4999-8999-999999999999','Paarden Verborgen','hidden@example.invalid','active');
    insert into patient_recent_visits values('${actor}','22222222-2222-4222-8222-222222222222',now());`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261118200000_client_search_refinement.sql', import.meta.url), 'utf8'));
  const search = async (text, archived = false, recent = false, limit = 9) => (await db.query('select * from search_patient_choices_v2($1,$2,$3,$4,$5)', [actor, text, recent, archived ? 'all' : 'active', limit])).rows;
  assert.deepEqual((await search('paarden')).map(x => x.name), ['Paarden','A Paardenstal','Zoë Paarden','A Renpaarden']);
  assert.equal((await search('PAARDEN ZOE'))[0].name, 'Zoë Paarden');
  assert.equal((await search('EXACT@example.invalid'))[0].name, 'Paarden');
  assert.equal((await search('paarden', true)).length, 5);
  assert.equal((await db.query('select * from search_patient_choices_v2($1,$2,false,$3,500)', [actor,'paarden','archived'])).rows.length, 1);
  assert.equal((await search('', false, true)).length, 1);
  assert.equal((await search('paarden', false, false, 2)).length, 2);
  for (const text of ['nobody', '%', '_', "' OR true --"]) assert.equal((await search(text)).length, 0);
  const rights = (await db.query("select has_function_privilege('anon','search_patient_choices_v2(uuid,text,boolean,text,integer)','execute') anon,has_function_privilege('authenticated','search_patient_choices_v2(uuid,text,boolean,text,integer)','execute') browser,has_function_privilege('service_role','search_patient_choices_v2(uuid,text,boolean,text,integer)','execute') service")).rows[0];
  assert.deepEqual(rights, { anon:false,browser:false,service:true });
  await db.exec(`create table platform_updates(id uuid primary key default gen_random_uuid(),slug text unique,title text,summary text,body text,next_step text,status text,category text,audience text,published boolean,action_path text,action_label text,revision integer default 1);
    create table platform_update_events(update_id uuid references platform_updates,title text,body text,status text,revision integer);`);
  const note = readFileSync(new URL('../supabase/migrations/20261118201000_client_search_update.sql', import.meta.url), 'utf8');
  await db.exec(note); await db.exec(note);
  const update = (await db.query('select status,published,audience from platform_updates')).rows;
  assert.deepEqual(update, [{ status:'review',published:true,audience:'dashboard' }]);
  assert.equal((await db.query('select * from platform_update_events')).rows.length, 1);
  console.log('Client search: ranking, accents, reversed words, email, archive, recent, access, limits, privileges and idempotent Updates publication passed.');
} finally { await db.close(); }
