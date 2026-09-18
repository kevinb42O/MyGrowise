import type { APIRoute } from 'astro';

export const prerender = false;
export const POST: APIRoute = async () =>
  new Response(JSON.stringify({ error: 'Deze webhook is niet actief.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
