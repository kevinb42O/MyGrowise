// PGLITE_MODULE=/path/to/pglite/dist/index.cjs node tests/platform-updates-isolated-db.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222',
  staff = '33333333-3333-4333-8333-333333333333';
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text);
 create table profiles(id uuid primary key);create table user_roles(user_id uuid,role text);
 create table security_audit_log(actor_user_id uuid,action text,object_type text,object_id text,metadata jsonb);
 insert into profiles values('${owner}'),('${other}'),('${staff}');insert into user_roles values('${owner}','super_admin'),('${other}','super_admin'),('${staff}','support');
 insert into auth.users values('${owner}','virginie@example.invalid'),('${other}','bourguignonphotography@gmail.com');
 grant select on user_roles to service_role; grant insert on security_audit_log to service_role;`);
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/20261118190000_platform_updates.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/20261118191000_platform_updates_history.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal((await db.query('select * from platform_updates')).rows.length, 10);
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/20261118192000_update_feedback_mail_and_scope.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const call = async (action, id, data, actor = owner) =>
    (
      await db.query('select mutate_platform_update($1,$2,$3,$4,$5) as id', [
        actor,
        actor === owner ? 'Virginie' : 'Kevin',
        action,
        id,
        JSON.stringify(data),
      ])
    ).rows[0].id;
  const fields = {
    slug: 'nieuwe-verbetering',
    title: 'Een heldere verbetering',
    summary: 'Je vindt makkelijker wat je nodig hebt.',
    body: 'Uitleg voor Virginie.',
    next_step: 'Eerst de uitvoering.',
    status: 'planned',
    category: 'Werkruimte',
    published: false,
    action_path: '',
    action_label: '',
  };
  await assert.rejects(call('create', null, fields, staff), /forbidden/);
  const id = await call('create', null, fields);
  const get = async () =>
    (await db.query('select * from platform_updates where id=$1', [id])).rows[0];
  assert.equal((await get()).published, false);
  assert.equal(
    (await db.query('select * from platform_update_events where update_id=$1', [id])).rows.length,
    1,
  );
  await call('edit', id, { ...fields, revision: 1, published: true, notify: false });
  assert.equal((await get()).revision, 2, 'publication creates new revision');
  await call('edit', id, {
    ...fields,
    revision: 2,
    published: true,
    notify: false,
    title: 'Kleine correctie',
  });
  assert.equal((await get()).revision, 2, 'correction does not make old update new');
  await assert.rejects(
    call('event', id, {
      revision: 1,
      title: 'Te laat',
      body: 'Verouderde bewerking.',
      status: 'released',
      next_step: '',
    }),
    /conflict/,
  );
  assert.equal((await get()).status, 'planned');
  await call('event', id, {
    revision: 2,
    title: 'We zijn begonnen',
    body: 'De eerste stappen zijn gezet.',
    status: 'in_progress',
    next_step: 'De werking nakijken.',
  });
  assert.equal((await get()).revision, 3);
  assert.equal((await get()).status, 'in_progress');
  await call('read', id, { revision: 3 });
  await call('read', id, { revision: 1 });
  assert.equal(
    (
      await db.query(
        'select revision from platform_update_reads where user_id=$1 and update_id=$2',
        [owner, id],
      )
    ).rows[0].revision,
    3,
    'late read never moves backwards',
  );
  const token = '44444444-4444-4444-8444-444444444444';
  await call('comment', id, { token, body: 'Kunnen we dit ook op telefoon gebruiken?' });
  await call('comment', id, { token, body: 'Kunnen we dit ook op telefoon gebruiken?' });
  assert.equal(
    (await db.query('select * from platform_update_comments where update_id=$1', [id])).rows.length,
    1,
    'retry is idempotent',
  );
  await call('feedback', id, { comment_id: token, feedback_status: 'handling' }, other);
  await assert.rejects(
    call('feedback', id, { comment_id: token, feedback_status: 'answered' }, other),
    /invalid_status/,
  );
  await call(
    'comment',
    id,
    {
      token: '55555555-5555-4555-8555-555555555555',
      body: 'Ja, de weergave past zich aan je telefoon aan.',
      reply_to: token,
      event_id: (
        await db.query(
          'select id from platform_update_events where update_id=$1 order by position desc limit 1',
          [id],
        )
      ).rows[0].id,
    },
    other,
  );
  assert.equal(
    (await db.query('select feedback_status from platform_update_comments where id=$1', [token]))
      .rows[0].feedback_status,
    'answered',
  );
  const unread = await db.query('select * from list_platform_updates($1,$2,$3,$4,true)', [
    owner,
    'all',
    '',
    0,
  ]);
  assert.ok(unread.rows.some((r) => r.id === id));
  assert.equal(typeof unread.rows[0].title, 'string');
  assert.equal(
    (await db.query('select * from list_platform_updates($1,$2,$3,$4,true)', [staff, 'all', '', 0]))
      .rows.length,
    0,
  );
  await assert.rejects(
    call('event', id, {
      revision: (await get()).revision,
      title: 'Ongeldig',
      body: 'Dit moet volledig terugrollen.',
      status: 'wrong',
      next_step: '',
    }),
    /check constraint/,
  );
  assert.equal((await get()).status, 'in_progress');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    for (const table of [
      'platform_updates',
      'platform_update_events',
      'platform_update_comments',
      'platform_update_reads',
    ])
      await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    await assert.rejects(
      db.query('select mutate_platform_update($1,$2,$3,$4,$5)', [
        owner,
        'Virginie',
        'read',
        id,
        '{"revision":1}',
      ]),
      /permission denied/,
    );
    await db.exec('reset role');
  }
  for (let i = 0; i < 14; i++)
    await call('create', null, { ...fields, slug: `extra-${i}`, published: true });
  const first = (
    await db.query('select * from list_platform_updates($1,$2,$3,$4,false)', [owner, 'all', '', 0])
  ).rows;
  const second = (
    await db.query('select * from list_platform_updates($1,$2,$3,$4,false)', [owner, 'all', '', 12])
  ).rows;
  assert.equal(first.length, 12);
  assert.equal(second.length, 12);
  assert.equal(Number(first[0].total_count), 25);
  assert.equal(new Set([...first, ...second].map((r) => r.id)).size, 24);
  assert.ok(
    first.every((r) => ['planned', 'in_progress', 'review', 'paused'].includes(r.status)),
    'active improvements lead the list',
  );
  assert.equal(
    (
      await db.query('select * from list_platform_updates($1,$2,$3,$4,false)', [
        owner,
        'all',
        'Uitleg voor Virginie.',
        0,
      ])
    ).rows.length,
    12,
    'search includes body content',
  );

  const mailJobs = (await db.query('select * from platform_update_mail_jobs')).rows;
  assert.equal(
    mailJobs.length,
    1,
    'Virginie queues one notification, the designer reply does not notify himself',
  );
  assert.equal(mailJobs[0].recipient, 'bourguignonphotography@gmail.com');
  assert.equal(mailJobs[0].payload.body, 'Kunnen we dit ook op telefoon gebruiken?');
  assert.equal(mailJobs[0].payload.title, 'Kleine correctie');
  const claim = (await db.query('select * from claim_platform_update_mail(1,null)')).rows;
  assert.equal(claim.length, 1);
  assert.equal(
    (await db.query('select * from claim_platform_update_mail(1,null)')).rows.length,
    0,
    'a live lease prevents duplicate delivery',
  );
  await db.query("update platform_update_mail_jobs set lease_until=now()-interval '1 minute'");
  const reclaimed = (await db.query('select * from claim_platform_update_mail(1,null)')).rows;
  assert.equal(reclaimed[0].attempts, 2);
  assert.notEqual(reclaimed[0].lease_token, claim[0].lease_token);
  const website = (
    await db.query("select * from list_platform_updates($1,'all','',0,false,'website')", [owner])
  ).rows;
  assert.ok(website.length > 0);
  assert.ok(website.every((row) => row.audience === 'website'));
  await db.exec('set role service_role');
  await call('read', id, { revision: 99 });
  assert.ok((await db.query('select * from platform_updates')).rows.length > 0);
  await db.exec('reset role');
  assert.ok((await db.query('select * from security_audit_log')).rows.length >= 6);
  console.log(
    'PASS updates SQL: history, roles, publication, corrections, atomic milestones, optimistic locking, monotonic reads, comment retries, answers, unread filtering and audit.',
  );
} finally {
  await db.close();
}
