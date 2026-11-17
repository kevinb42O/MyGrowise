// Explicit post-deployment setup; credentials are bound parameters, never SQL literals/logs.
import pg from 'pg';
import fs from 'node:fs';
const origin = new URL(process.env.PUBLIC_SITE_URL || 'https://www.mygrowise.be');
if (origin.protocol !== 'https:' || !['mygrowise.be','www.mygrowise.be','mygrowise.vercel.app'].includes(origin.hostname) || origin.username || origin.password) throw new Error('Use the production MyGrowise HTTPS origin.');
// Avoid cross-origin redirects stripping the Authorization header.
if(origin.hostname==='mygrowise.be')origin.hostname='www.mygrowise.be';
const token = process.env.CRON_SECRET?.trim();
if (!token || token.length < 16 || !process.env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL and the deployed CRON_SECRET (at least 16 characters) are required.');
const db = new pg.Client({connectionString:process.env.SUPABASE_DB_URL,connectionTimeoutMillis:10000});
try {
 await db.connect();
 if (!(await db.query("select 1 from supabase_migrations.schema_migrations where version='20261117170000'")).rowCount) throw new Error('Apply the practice migration and deploy the matching application first.');
 const health = await fetch(new URL('/api/cron/booking-reminders',origin.origin),{method:'HEAD',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 if (!health.ok) throw new Error('The deployed reminder endpoint is not ready or CRON_SECRET does not match.');
 await db.query('begin');
 await db.query('create extension if not exists pg_cron; create extension if not exists pg_net; create extension if not exists supabase_vault');
 for (const [name,value] of [['booking_reminder_endpoint',new URL('/api/cron/booking-reminders',origin.origin).href],['booking_reminder_token',token]]) {
  const existing=await db.query('select id from vault.secrets where name=$1',[name]);
  if (existing.rowCount) await db.query('select vault.update_secret($1,$2)',[existing.rows[0].id,value]);
  else await db.query('select vault.create_secret($1,$2)',[value,name]);
 }
 await db.query(fs.readFileSync(new URL('./sql/booking-reminder-dispatch.sql',import.meta.url),'utf8'));
 await db.query("select cron.schedule('mygrowise-booking-reminders','* * * * *','select public.dispatch_due_booking_reminders()')");
 await db.query('commit');
 console.log('Configured one-minute checks for due reminders. No mail sent by this setup command.');
} catch (error) {
 await db.query('rollback').catch(()=>{});
 // Database error details may contain bound secrets; report a safe summary only.
 console.error(error instanceof Error && !('severity' in error) ? error.message : 'Reminder setup failed; transaction rolled back.');
 process.exitCode=1;
} finally { await db.end(); }
