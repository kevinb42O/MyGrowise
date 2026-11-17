// Run using PGLITE_MODULE=/absolute/path/to/pglite/dist/index.cjs node tests/admin-notifications-isolated-db.mjs
// Executes actual PostgreSQL trigger SQL in memory; no production connection or emails.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const support = '22222222-2222-4222-8222-222222222222';
const customer = '33333333-3333-4333-8333-333333333333';
const conversation = '44444444-4444-4444-8444-444444444444';
try {
  await db.exec(`
    create type public.internal_notification_type as enum ('internal_message','support_message');
    create table user_roles(user_id uuid,role text);
    create table support_conversations(id uuid primary key,subject text,assigned_to uuid);
    create table support_messages(id uuid default gen_random_uuid(),conversation_id uuid,sender_user_id uuid,sender_type text,is_internal_note boolean default false);
    create table internal_notifications(recipient_user_id uuid,notification_type internal_notification_type,support_conversation_id uuid,title text check(char_length(title) between 2 and 180));
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261118090000_staff_notification_integrity.sql', import.meta.url), 'utf8'));
  await db.exec('create trigger notify after insert on support_messages for each row execute function notify_support_staff()');
  await db.query("insert into user_roles values($1,'super_admin'),($1,'support'),($2,'support'),($3,'customer')", [owner, support, customer]);
  await db.query('insert into support_conversations values($1,$2,null)', [conversation, 'é'.repeat(180)]);
  const message = (sender, type, internal = false) => db.query('insert into support_messages(conversation_id,sender_user_id,sender_type,is_internal_note) values($1,$2,$3,$4)', [conversation, sender, type, internal]);
  await message(customer, 'customer');
  let rows = (await db.query('select * from internal_notifications')).rows;
  assert.equal(rows.length, 2, 'multi-role owner receives one receipt');
  assert.ok(rows.every(row => [...row.title].length === 180), 'long Unicode subject stays valid');
  await message(owner, 'staff');
  await message(support, 'staff', true);
  assert.equal((await db.query('select * from internal_notifications')).rows.length, 2, 'staff replies and notes never notify staff');
  await db.exec('delete from internal_notifications');
  await db.query('update support_conversations set assigned_to=$1', [support]);
  await message(null, 'guest');
  rows = (await db.query('select * from internal_notifications')).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipient_user_id, support, 'assigned conversation notifies only assignee');
  await db.exec('delete from internal_notifications');
  await message(support, 'customer');
  assert.equal((await db.query('select * from internal_notifications')).rows.length, 0, 'sender never receives own notification');
  console.log('PASS: PostgreSQL trigger — long Unicode titles, unique role recipients, staff/notes excluded, guest assignee, self exclusion.');
} finally { await db.close(); }
