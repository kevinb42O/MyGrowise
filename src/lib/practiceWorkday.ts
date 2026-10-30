import type { PracticeBooking } from './practiceStore';

export const brusselsDay = (value: string | Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));

export const workdayBookings = (bookings: PracticeBooking[], now = new Date()) => {
  const today = brusselsDay(now);
  const active = bookings.filter(booking => ['confirmed', 'completed', 'no_show'].includes(booking.status));
  return {
    today: active.filter(booking => brusselsDay(booking.startsAt) === today),
    upcoming: active.filter(booking => booking.status === 'confirmed' && brusselsDay(booking.startsAt) > today).slice(0, 5),
    awaitingReport: active.filter(booking => ['confirmed', 'completed'].includes(booking.status) && Date.parse(booking.endsAt) <= now.getTime()),
  };
};
