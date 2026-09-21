import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.');

const database = new DatabaseSync(new URL('../data/admin/mygrowise.sqlite', import.meta.url));
const localPractitioners = database.prepare('select * from practitioners order by slug').all();
const rules = database.prepare('select practitioner_id, weekday, start_time, end_time from availability_rules').all();
const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const practitionerRecords = localPractitioners.map((row) => ({
  slug: String(row.slug), name: String(row.name), public_role: String(row.public_role || ''), bio: String(row.bio || ''),
  expertise: JSON.parse(String(row.expertise || '[]')), languages: JSON.parse(String(row.languages || '[]')), active: Boolean(row.active),
}));
let result = await client.from('practitioners').upsert(practitionerRecords, { onConflict: 'slug' }).select('id,slug');
if (result.error) throw result.error;
const remoteIds = new Map(result.data.map((row) => [row.slug, row.id]));
const localSlugById = new Map(localPractitioners.map((row) => [String(row.id), String(row.slug)]));

const settings = localPractitioners.map((row) => ({
  practitioner_id: remoteIds.get(String(row.slug)), appointment_duration_minutes: Number(row.appointment_duration_minutes || 60),
  minimum_notice_hours: Number(row.minimum_notice_hours || 2), booking_horizon_days: Number(row.booking_horizon_days || 30), requests_enabled: Boolean(row.requests_enabled),
}));
result = await client.from('practitioner_settings').upsert(settings, { onConflict: 'practitioner_id' });
if (result.error) throw result.error;

const remoteRules = rules.flatMap((row) => {
  const slug = localSlugById.get(String(row.practitioner_id)); const practitioner_id = slug ? remoteIds.get(slug) : undefined;
  return practitioner_id ? [{ practitioner_id, weekday: Number(row.weekday), start_time: String(row.start_time), end_time: String(row.end_time) }] : [];
});
if (remoteRules.length) {
  result = await client.from('availability_rules').upsert(remoteRules, { onConflict: 'practitioner_id,weekday,start_time,end_time' });
  if (result.error) throw result.error;
}
console.log(`Migrated ${practitionerRecords.length} practitioners and ${remoteRules.length} availability rules to Supabase.`);
