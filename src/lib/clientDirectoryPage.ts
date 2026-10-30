import type { AstroGlobal } from 'astro';
import { hasPermission } from './adminAuth';
import { auditPatientDirectoryAccess, getBookingForPatientCreation, getPatientReference, getPatientStaff, listPatientRecords, listUnlinkedCustomerAccounts } from './clientRecords';
export async function loadClientDirectoryPage(context: Pick<AstroGlobal, 'locals' | 'params' | 'url' | 'request' | 'redirect'>) {
  const practice = context.url.pathname.startsWith('/praktijk');
  const recordsBase = practice ? '/praktijk/clienten' : '/admin/clienten';


  const user = context.locals.currentUser!;
  const canWrite = hasPermission(user, 'client_records.write');
  const canAssign = hasPermission(user, 'client_records.assign');
  const canArchive = hasPermission(user, 'client_records.archive');
  const requestedStatus = context.url.searchParams.get('status') || 'active';
  const status = ['active', 'archived', 'all'].includes(requestedStatus) ? requestedStatus as 'active' | 'archived' | 'all' : 'active';
  await auditPatientDirectoryAccess(user, context.locals.requestId);
  const clients = await listPatientRecords(user, '', status);
  const staff = canAssign ? await getPatientStaff() : [];
  const customerSearch = (context.url.searchParams.get('klantzoek') || '').trim().slice(0, 80);
  const customerAccounts = canAssign ? await listUnlinkedCustomerAccounts(user, customerSearch) : [];
  const bookingId = context.url.searchParams.get('boeking') || '';
  const booking = bookingId ? await getBookingForPatientCreation(user, bookingId) : null;
  const linkedPatient = booking?.patientId ? await getPatientReference(user, booking.patientId, context.locals.requestId) : null;
  const bookingEmailMatches = booking && !booking.patientId && booking.clientEmail
    ? (await listPatientRecords(user, booking.clientEmail, 'active')).filter((client) => client.email?.toLowerCase() === booking.clientEmail.toLowerCase())
        .filter((client) => !client.customerUserId || client.customerUserId === booking.customerUserId)
    : [];
  const showBookingError = Boolean(bookingId && !booking);
  const formError = context.url.searchParams.get('fout') || '';
  const errors: Record<string, string> = {
    invalid_input: 'Controleer de naam en het e-mailadres.', invalid_patient: 'Controleer de naam en het e-mailadres.', not_found: 'De afspraak bestaat niet of je hebt er geen toegang toe.',
    not_allowed: 'Je hebt geen toegang tot deze dossieractie.',
    booking_not_ready: 'Deze afspraak is nog niet bevestigd of afgerond.',
    booking_already_linked: 'Deze afspraak is al aan een dossier gekoppeld.',
    booking_patient_mismatch: 'Deze afspraakgegevens komen niet overeen met het cliëntendossier.',
    patient_archived: 'Herstel het gearchiveerde dossier eerst voordat je er een afspraak aan koppelt.',
    dossier_niet_gevonden: 'De afspraak of het dossier is niet gevonden.',
    customer_not_found: 'Dit klantaccount is niet beschikbaar of heeft al een dossier.',
    potential_patient_match: 'Er bestaat al een los dossier met hetzelfde e-mailadres. Open dat dossier en koppel daar het klantaccount om dubbele dossiers te vermijden.',
    invalid_assignee: 'Kies een medewerker met toegang tot cliëntendossiers.',
  };
  const date = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium' }).format(new Date(value));
  const dateTime = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return { canWrite, canAssign, status, clients, staff, customerSearch, customerAccounts, bookingId, booking, linkedPatient, bookingEmailMatches, showBookingError, formError, errors, date, dateTime, practice, recordsBase };
}
export type ClientDirectoryData = Exclude<Awaited<ReturnType<typeof loadClientDirectoryPage>>, Response>;
