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


/** Shared by the workday and navigation so both resolve the same report tasks. */
export const buildPracticeTasks = (
  user: { sub: string; roles: readonly string[] },
  records: { patients: { id: string; fullName: string }[]; notes: { id: string; patient_id: string; booking_id: string | null; status: string; created_by: string | null }[] },
  bookings: Pick<PracticeBooking, 'id' | 'patientId' | 'clientName' | 'startsAt' | 'endsAt' | 'status'>[],
  now = new Date(),
) => {
  const patients = new Map(records.patients.map(patient => [patient.id, patient]));
  const notedBookings = new Set(records.notes.map(note => note.booking_id));
  const drafts = records.notes.filter(note => note.status === 'draft' && (note.created_by === user.sub || user.roles.includes('super_admin')));
  const taskDate = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium' }).format(new Date(value));
  return [
    ...drafts.map(note => ({ id: note.id, name: patients.get(note.patient_id)!.fullName, label: 'Conceptverslag afwerken', href: `/praktijk/clienten/${note.patient_id}?concept=${note.id}#verslag-${note.id}` })),
    ...bookings.filter(booking => ['confirmed', 'completed'].includes(booking.status) && Date.parse(booking.endsAt) <= now.getTime() && !notedBookings.has(booking.id) && (!booking.patientId || patients.has(booking.patientId)))
      .map(booking => ({ id: booking.id, name: booking.clientName, label: `${booking.patientId ? 'Verslag schrijven' : 'Dossier koppelen en verslag schrijven'} · ${taskDate(booking.startsAt)}`, href: booking.patientId ? `/praktijk/clienten/${booking.patientId}?boeking=${booking.id}#nieuw-verslag` : `/praktijk/clienten?boeking=${booking.id}` })),
  ];
};
