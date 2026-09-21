import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabase/server';

export const prerender = false;

/** A non-sensitive readiness probe for hosting and uptime monitors. */
export const GET: APIRoute = async () => {
  try {
    const { error } = await getSupabaseAdmin().from('products').select('id', { head: true, count: 'exact' });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, service: 'mygrowise-api' }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, service: 'mygrowise-api' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
};
