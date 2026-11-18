import type { APIRoute } from 'astro';
import { hasPermission, isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { deliverUpdateFeedbackMail } from '../../../../lib/updateFeedbackMail';
import { getSupabaseAdmin } from '../../../../lib/supabase/server';
import {
  UPDATE_STATES,
  UPDATE_CATEGORIES,
  validUpdatePath,
} from '../../../../lib/platformUpdateTypes';
export const prerender = false;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
const uuid = (v: unknown) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const pageOf = (value: string | null) =>
  Math.min(10000, Math.max(1, Number.parseInt(value || '1', 10) || 1));
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.adminUser;
  if (!hasPermission(user, 'updates.read')) return json({ error: 'Geen toegang.' }, 403);
  try {
    const db = getSupabaseAdmin(),
      slug = url.searchParams.get('slug');
    if (slug) {
      const { data: item, error } = await db
        .from('platform_updates')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      if (!item || (!item.published && !hasPermission(user, 'updates.manage')))
        return json({ error: 'Deze update is niet gevonden.' }, 404);
      const eventPage = pageOf(url.searchParams.get('events')),
        commentPage = pageOf(url.searchParams.get('comments'));
      const [events, comments] = await Promise.all([
        db
          .from('platform_update_events')
          .select('*', { count: 'exact' })
          .eq('update_id', item.id)
          .order('position')
          .order('id')
          .range((eventPage - 1) * 20, eventPage * 20 - 1),
        db
          .from('platform_update_comments')
          .select('*,event:platform_update_events!event_id(id,title,position)', { count: 'exact' })
          .eq('update_id', item.id)
          .order('created_at')
          .order('id')
          .range((commentPage - 1) * 20, commentPage * 20 - 1),
      ]);
      if (events.error || comments.error) throw events.error || comments.error;
      return json({
        item,
        events: events.data,
        comments: comments.data,
        eventCount: events.count,
        commentCount: comments.count,
      });
    }
    const page = pageOf(url.searchParams.get('page')),
      filter = url.searchParams.get('filter') || 'all',
      q = (url.searchParams.get('q') || '').slice(0, 120);
    if (filter === 'drafts' && !hasPermission(user, 'updates.manage'))
      return json({ error: 'Geen toegang.' }, 403);
    const result = await db.rpc('list_platform_updates', {
      p_actor: user!.sub,
      p_filter: filter,
      p_query: q,
      p_offset: (page - 1) * 12,
      p_unread: url.searchParams.get('unread') === '1',
      p_audience: ['website', 'dashboard'].includes(url.searchParams.get('audience') || '')
        ? url.searchParams.get('audience')
        : 'all',
    });
    if (result.error) throw result.error;
    return json({ items: result.data || [], total: result.data?.[0]?.total_count || 0, page });
  } catch {
    return json({ error: 'De updates konden niet worden geladen. Probeer het opnieuw.' }, 503);
  }
};
export const POST: APIRoute = async ({ locals, request }) => {
  const user = locals.adminUser;
  if (!hasPermission(user, 'updates.feedback')) return json({ error: 'Geen toegang.' }, 403);
  if (!isTrustedFormOrigin(request)) return json({ error: 'Ongeldige aanvraag.' }, 403);
  if (Number(request.headers.get('content-length')) > 24000)
    return json({ error: 'De tekst is te lang.' }, 413);
  let payload: any;
  try {
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: 'De tekst is te lang.' }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  }
  const { action, id, data } = payload || {};
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    !['create', 'edit', 'event', 'comment', 'feedback', 'read'].includes(action)
  )
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  if (action !== 'create' && !uuid(id)) return json({ error: 'Ongeldige update.' }, 400);
  if (
    ['create', 'edit', 'event', 'feedback'].includes(action) &&
    !hasPermission(user, 'updates.manage')
  )
    return json({ error: 'Geen toegang.' }, 403);
  const text = (key: string, min: number, max: number) =>
    typeof data[key] === 'string' && data[key].trim().length >= min && data[key].length <= max;
  let valid = true;
  if (action === 'create' || action === 'edit')
    valid =
      text('title', 3, 160) &&
      text('summary', 3, 350) &&
      text('body', 3, 12000) &&
      text('next_step', 0, 1200) &&
      UPDATE_CATEGORIES.includes(data.category) &&
      ['website', 'dashboard'].includes(data.audience) &&
      typeof data.published === 'boolean' &&
      text('action_path', 0, 200) &&
      text('action_label', 0, 80) &&
      (!data.action_path || validUpdatePath(data.action_path)) &&
      Boolean(data.action_path) === Boolean(data.action_label);
  if (action === 'create')
    valid =
      valid &&
      typeof data.slug === 'string' &&
      /^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.slug) &&
      data.slug.length <= 120 &&
      Object.hasOwn(UPDATE_STATES, data.status);
  if (action === 'edit') valid = valid && typeof data.notify === 'boolean';
  if (action === 'event')
    valid =
      text('title', 3, 160) &&
      text('body', 3, 4000) &&
      text('next_step', 0, 1200) &&
      Object.hasOwn(UPDATE_STATES, data.status);
  if (['read', 'edit', 'event'].includes(action))
    valid = valid && Number.isSafeInteger(data.revision) && data.revision > 0;
  if (action === 'comment')
    valid =
      text('body', 1, 4000) &&
      uuid(data.token) &&
      (!data.reply_to || uuid(data.reply_to)) &&
      (!data.event_id || uuid(data.event_id));
  if (action === 'feedback')
    valid = uuid(data.comment_id) && ['received', 'handling'].includes(data.feedback_status);
  if (!valid) return json({ error: 'Controleer de velden en de lengte van je tekst.' }, 400);
  try {
    const { data: result, error } = await getSupabaseAdmin().rpc('mutate_platform_update', {
      p_actor: user!.sub,
      p_name: user!.name,
      p_action: action,
      p_id: id || null,
      p_data: data,
    });
    if (error) {
      if (error.message.includes('conflict'))
        return json(
          {
            error:
              'Deze update is ondertussen gewijzigd. Open de update in een tweede tabblad om de nieuwste versie te vergelijken. Je tekst blijft hier staan.',
          },
          409,
        );
      if (error.code === '23505')
        return json({ error: 'Deze linknaam bestaat al. Kies een andere.' }, 409);
      throw error;
    }
    let notification: string | undefined;
    if (action === 'comment') {
      try {
        const delivery = await deliverUpdateFeedbackMail(1, data.token);
        notification = delivery.sent
          ? 'sent'
          : delivery.failed || !delivery.configured
            ? 'pending'
            : undefined;
      } catch {
        notification = 'pending';
      }
    }
    return json({ id: result, notification });
  } catch {
    return json({ error: 'Opslaan is niet gelukt. Je tekst blijft staan; probeer opnieuw.' }, 503);
  }
};
export const ALL: APIRoute = () => json({ error: 'Methode niet toegestaan.' }, 405);
