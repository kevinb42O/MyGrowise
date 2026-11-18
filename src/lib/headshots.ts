import { getSupabaseAdmin } from './supabase/server';
import { ownHeadshotPath } from './headshotPresentation';

export const HEADSHOT_BUCKET = 'user-headshots';

async function ensureBucket() {
  const storage = getSupabaseAdmin().storage;
  let { data } = await storage.getBucket(HEADSHOT_BUCKET);
  if (!data) {
    const created = await storage.createBucket(HEADSHOT_BUCKET, { public: false, fileSizeLimit: 1024 * 1024, allowedMimeTypes: ['image/webp'] });
    if (created.error) data = (await storage.getBucket(HEADSHOT_BUCKET)).data;
    else data = created.data ? (await storage.getBucket(HEADSHOT_BUCKET)).data : null;
  }
  if (!data || data.public) throw new Error('headshot_failed');
}

export async function removeHeadshotObject(path: string) {
  try {
    const { error } = await getSupabaseAdmin().storage.from(HEADSHOT_BUCKET).remove([path]);
    if (error) console.error('[headshot] Old image cleanup failed');
  } catch { console.error('[headshot] Image cleanup unavailable'); }
}

/** The target ID comes from the session, or from server-side account creation. */
export async function saveHeadshot(userId: string, image: Buffer | null): Promise<string | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error('headshot_failed');
  const previous = ownHeadshotPath(data.user.app_metadata?.headshot_path, userId);
  let path: string | null = null;
  if (image) {
    await ensureBucket();
    path = `${userId}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await client.storage.from(HEADSHOT_BUCKET).upload(path, image, { contentType: 'image/webp', upsert: false });
    if (uploadError) {
      await removeHeadshotObject(path);
      throw new Error('headshot_failed');
    }
  }
  try {
    const { error: updateError } = await client.auth.admin.updateUserById(userId, { app_metadata: { ...data.user.app_metadata, headshot_path: path } });
    if (updateError) throw new Error('headshot_failed');
  } catch {
    if (path) await removeHeadshotObject(path);
    throw new Error('headshot_failed');
  }
  if (previous) await removeHeadshotObject(previous);
  return path;
}
