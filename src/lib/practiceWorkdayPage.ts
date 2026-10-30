import type { AstroGlobal } from 'astro';
import { getPracticeSummary, listBookings } from './practiceStore';
import { getPracticeNoteTasks } from './clientRecords';
import { hasPermission } from './adminAuth';
import { workdayBookings } from './practiceWorkday';
export async function loadPracticeWorkdayPage(context: Pick<AstroGlobal, 'locals' | 'url'>) {
  const user = context.locals.currentUser!;
  const practitionerId = user.practitionerId!;
  const canRead = hasPermission(user, 'client_records.read');
  const canWrite = hasPermission(user, 'client_records.write');
  const allBookings = await listBookings(practitionerId);
  const [summary, records] = await Promise.all([
    getPracticeSummary(practitionerId, allBookings),
    canRead ? getPracticeNoteTasks(user, context.locals.requestId) : Promise.resolve({ patients: [], notes: [] }),
  ]);
  const now = new Date();
  const day = workdayBookings(allBookings, now);
  const patients = new Map(records.patients.map(patient => [patient.id, patient]));
  const notedBookings = new Set(records.notes.map(note => note.booking_id));
  const drafts = records.notes.filter(note => note.status === 'draft' && (note.created_by === user.sub || user.roles.includes('super_admin')));
  const taskDate = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium' }).format(new Date(value));
  const tasks = [
    ...drafts.map(note => ({ id: note.id, name: patients.get(note.patient_id)!.fullName, label: 'Conceptverslag afwerken', href: `/praktijk/clienten/${note.patient_id}?concept=${note.id}#verslag-${note.id}` })),
    ...day.awaitingReport.filter(booking => !notedBookings.has(booking.id) && (!booking.patientId || patients.has(booking.patientId))).map(booking => ({ id: booking.id, name: booking.clientName, label: `${booking.patientId ? 'Verslag schrijven' : 'Dossier koppelen en verslag schrijven'} · ${taskDate(booking.startsAt)}`, href: booking.patientId ? `/praktijk/clienten/${booking.patientId}?boeking=${booking.id}#nieuw-verslag` : `/praktijk/clienten?boeking=${booking.id}` })),
  ];
  const forbidden = context.url.searchParams.get('forbidden') === 'admin';
  const formatDate = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const time = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const labels = { confirmed: 'Bevestigd', completed: 'Uitgevoerd', no_show: 'Niet verschenen' };
  const todayLabel = new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return { user, canWrite, summary, now, day, tasks, forbidden, formatDate, time, labels, todayLabel };
}
export type PracticeWorkdayData = Awaited<ReturnType<typeof loadPracticeWorkdayPage>>;
