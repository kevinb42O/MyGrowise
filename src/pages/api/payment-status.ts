import type { APIRoute } from 'astro';

export const prerender = false;
export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ error: 'Payment status is nog niet beschikbaar.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
