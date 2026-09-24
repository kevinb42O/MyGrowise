import type { APIRoute } from 'astro';
import { getBookableSlots, getPractitionerBySlug } from '../../../lib/practiceStore';

export const prerender = false;
export const GET: APIRoute = async ({ params, url }) => {
  const practitioner = await getPractitionerBySlug(params.slug || '');
  if (!practitioner) return new Response(JSON.stringify({ error: 'Professional niet gevonden.' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 14), 1), practitioner.bookingHorizonDays);
  const slots = (await getBookableSlots(practitioner.id, days)).map(({ startsAt, endsAt, dateLabel, timeLabel }) => ({ startsAt, endsAt, dateLabel, timeLabel }));
  return new Response(JSON.stringify({ practitioner: { slug: practitioner.slug, name: practitioner.name }, timeZone: 'Europe/Brussels', durationMinutes: practitioner.appointmentDurationMinutes, slots }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60, stale-while-revalidate=120' } });
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
