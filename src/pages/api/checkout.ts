import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () =>
  new Response(JSON.stringify({
    error: 'Checkout is nog niet geactiveerd.',
    nextStep: 'Configureer eerst de goedgekeurde Wise- of PSP-productieintegratie.',
  }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
