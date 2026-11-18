import type { APIRoute } from 'astro';
import { hasPermission } from '../../../../../../lib/adminAuth';
import { getPatientReference } from '../../../../../../lib/clientRecords';
import { ownHeadshotPath } from '../../../../../../lib/headshotPresentation';
import { HEADSHOT_BUCKET } from '../../../../../../lib/headshots';
import { getSupabaseAdmin } from '../../../../../../lib/supabase/server';

export const prerender = false;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const missing = () => new Response(null, {status:404, headers});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A colleague's private photo is only available in a dossier both people can access. */
export const GET: APIRoute = async ({locals, params}) => {
  const user = locals.currentUser;
  if (!user) return new Response(null, {status:401, headers});
  if (!hasPermission(user, 'client_records.read')) return missing();
  const patientId = params.id || '', userId = params.userId || '';
  if (!uuid.test(patientId) || !uuid.test(userId)) return missing();
  try {
    if (!await getPatientReference(user, patientId, locals.requestId)) return missing();
    const client = getSupabaseAdmin();
    const assignment = await client.from('patient_assignments').select('id').eq('patient_id', patientId).eq('user_id', userId).is('ended_at', null).maybeSingle();
    if (assignment.error || !assignment.data) return missing();
    const account = await client.auth.admin.getUserById(userId);
    if (account.error || !account.data.user) return missing();
    const path = ownHeadshotPath(account.data.user.app_metadata?.headshot_path, userId);
    if (path) {
      const photo = await client.storage.from(HEADSHOT_BUCKET).download(path);
      if (photo.error || !photo.data) return missing();
      return new Response(photo.data, {headers:{...headers, 'Content-Type':'image/webp', 'Content-Security-Policy':"default-src 'none'"}});
    }
    // Existing practitioner portraits are resolved through the account relation, never a name.
    const practitioner = await client.from('practitioners').select('image_url').eq('user_id', userId).maybeSingle();
    const src = practitioner.data?.image_url;
    if (practitioner.error || typeof src !== 'string' || !/^\/images\/[a-z0-9/_-]+\.(?:jpg|jpeg|png|webp)$/i.test(src)) return missing();
    return new Response(null, {status:302, headers:{...headers, Location:src}});
  } catch {
    return new Response(null, {status:503, headers});
  }
};
export const ALL: APIRoute = () => new Response(null, {status:405, headers:{...headers, Allow:'GET'}});
