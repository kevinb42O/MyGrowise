import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../lib/adminAuth';
import { HEADSHOT_ERRORS, prepareHeadshot } from '../../../lib/headshotImage';
import { HEADSHOT_BUCKET, saveHeadshot } from '../../../lib/headshots';
import { ownHeadshotPath } from '../../../lib/headshotPresentation';
import { getSupabaseAdmin } from '../../../lib/supabase/server';

export const prerender = false;
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.currentUser;
  if (!user) return new Response(null, { status: 401, headers: privateHeaders });
  const path = ownHeadshotPath(user.headshotPath, user.sub);
  if (!path) return new Response(null, { status: 404, headers: privateHeaders });
  try {
    const { data, error } = await getSupabaseAdmin().storage.from(HEADSHOT_BUCKET).download(path);
    if (error || !data) throw new Error('unavailable');
    return new Response(data, { headers: { ...privateHeaders, 'Content-Type': 'image/webp', 'Content-Security-Policy': "default-src 'none'" } });
  } catch { return new Response(null, { status: 503, headers: privateHeaders }); }
};
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.currentUser;
  if (!user) return new Response('Niet aangemeld.', { status: 401 });
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  if (Number(request.headers.get('content-length')) > 4 * 1024 * 1024) return new Response('Kies een foto van maximaal 3 MB.', { status: 413 });
  let returnTo = user.roles.includes('customer') ? '/account/instellingen' : user.roles.includes('practitioner') ? '/praktijk/account' : '/admin/account';
  try {
    const form = await request.formData();
    const requestedReturn = String(form.get('return_to') || '');
    if (['/admin/account', '/admin/instellingen', '/praktijk/account', '/account/instellingen'].includes(requestedReturn)) returnTo = requestedReturn;
    const operation = String(form.get('operation') || 'save');
    if (!['save', 'remove'].includes(operation)) throw new Error('headshot_failed');
    const image = operation === 'remove' ? null : await prepareHeadshot(form.get('headshot'));
    if (!image && operation !== 'remove') throw new Error('headshot_missing');
    await saveHeadshot(user.sub, image);
    return new Response(null, { status: 303, headers: { ...privateHeaders, location: `${returnTo}?headshot=${operation === 'remove' ? 'removed' : 'saved'}#headshot` } });
  } catch (error) {
    const code = error instanceof Error && HEADSHOT_ERRORS[error.message] ? error.message : 'headshot_failed';
    return new Response(null, { status: 303, headers: { ...privateHeaders, location: `${returnTo}?headshot=${code}#headshot` } });
  }
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
