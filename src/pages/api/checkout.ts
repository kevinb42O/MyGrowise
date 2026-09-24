import type { APIRoute } from 'astro';
export const prerender = false;

export const POST: APIRoute = async () => new Response('Deze Wise-betaallink is vervangen door de handmatige betaalstroom.', { status: 410 });

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
