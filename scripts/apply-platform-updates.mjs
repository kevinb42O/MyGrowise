// Rehearses only these reviewed additive migrations; never pushes unrelated work.
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const files = [
  '20261118190000_platform_updates.sql',
  '20261118191000_platform_updates_history.sql',
  '20261118192000_update_feedback_mail_and_scope.sql',
];
const apply = process.argv.includes('--apply');
const db = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await db.connect();
  await db.query('begin isolation level repeatable read');
  await db.query("set local lock_timeout='5s';set local statement_timeout='30s'");
  await db.query("select pg_advisory_xact_lock(hashtext('mygrowise-platform-updates-migrations'))");
  const counts = async () =>
    (
      await db.query(
        'select (select count(*) from public.orders) orders,(select count(*) from public.entitlements) rights,(select count(*) from public.bookings) bookings,(select count(*) from public.patients) patients,(select count(*) from public.profiles) profiles',
      )
    ).rows[0];
  const before = await counts(),
    processed = [];
  for (const file of files) {
    const version = file.split('_')[0],
      sql = readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
    const existing = await db.query(
      'select statements from supabase_migrations.schema_migrations where version=$1',
      [version],
    );
    if (existing.rowCount) {
      assert.deepEqual(
        existing.rows[0].statements,
        [sql],
        `Registered migration ${version} differs; stop for review.`,
      );
      processed.push({ version, existing: true });
      continue;
    }
    await db.query(sql);
    await db.query(
      'insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])',
      [version, file.slice(15, -4), [sql]],
    );
    processed.push({ version, existing: false });
  }
  assert.deepEqual(
    await counts(),
    before,
    'Existing orders, rights, bookings, patients and profiles must remain unchanged.',
  );
  const invariants = (
    await db.query(
      `select (select count(*) from platform_updates) updates,(select count(*) from platform_update_events) milestones,(select count(*) from platform_update_comments) comments,(select count(*) from platform_update_mail_jobs) mail_jobs,(select count(*) from pg_policies where tablename like 'platform_update%') browser_policies`,
    )
  ).rows[0];
  assert.ok(Number(invariants.updates) >= 10);
  assert.equal(Number(invariants.browser_policies), 0);
  for (const table of [
    'platform_updates',
    'platform_update_comments',
    'platform_update_mail_jobs',
  ]) {
    const access = (
      await db.query(
        "select has_table_privilege('anon',$1,'SELECT') anonymous,has_table_privilege('authenticated',$1,'SELECT') browser",
        ['public.' + table],
      )
    ).rows[0];
    assert.equal(access.anonymous, false);
    assert.equal(access.browser, false);
  }
  await db.query(apply ? 'commit' : 'rollback');
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'applied-and-registered' : 'rehearsed-and-rolled-back',
        processed,
        preserved: before,
        invariants,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await db.query('rollback').catch(() => {});
  console.error('Updates migration rolled back:', error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
