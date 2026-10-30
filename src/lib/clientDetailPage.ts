import { getBookingForNote } from './clientRecords';
import type { AstroGlobal } from 'astro';
import {patientFields,genderLabels,parsePatientDetails} from './patientDetails';
import {getSupabaseAdmin} from './supabase/server';
import {isTrustedFormOrigin} from './adminAuth';
import { hasPermission } from './adminAuth';
import { getPatientDetail, getPatientStaff, listUnlinkedCustomerAccounts, noteTypeLabels } from './clientRecords';
export async function loadClientDetailPage(context: Pick<AstroGlobal, 'locals' | 'params' | 'url' | 'request' | 'redirect'>) {
  const practice = context.url.pathname.startsWith('/praktijk');
  const recordsBase = practice ? '/praktijk/clienten' : '/admin/clienten';


  const user = context.locals.currentUser!;
  const patientId = context.params.id || '';
  const historyNoteId = context.url.searchParams.get('geschiedenis') || '';
  const requestedNotePage = Number(context.url.searchParams.get('pagina') || '1');
  let detailsError='';
  let submittedDetails:Record<string,unknown>|null=null;
  if(context.request.method==='POST'){
   if(!isTrustedFormOrigin(context.request)||!hasPermission(user,'client_records.write'))return new Response('Geen toegang.',{status:403});
   const form=await context.request.formData();submittedDetails=Object.fromEntries(form.entries());
   try{
   const details=parsePatientDetails(submittedDetails);
   const {error}=await getSupabaseAdmin().rpc('save_patient_details',{p_actor:user.sub,p_patient:patientId,p_details:details,p_expected:String(form.get('expected_updated_at')||'')});
   if(error)throw new Error(error.code==='40001'?'Het dossier is intussen gewijzigd. Herlaad en controleer de gegevens.':'De gegevens konden niet worden opgeslagen. Controleer je toegang en invoer.');
   return context.redirect(`${recordsBase}/${patientId}?melding=gegevens`,303);
   }catch(cause){detailsError=cause instanceof Error?cause.message:'Opslaan is niet gelukt.';}
  }
  const bookingStatus=context.url.searchParams.get('status')||'',bookingFrom=context.url.searchParams.get('van')||'',bookingTo=context.url.searchParams.get('tot')||'';
  const patient = await getPatientDetail(user, patientId, historyNoteId, context.locals.requestId, requestedNotePage,Number(context.url.searchParams.get('afsprakenpagina')||1),bookingStatus,bookingFrom,bookingTo,context.url.searchParams.get('concept') || '');

  if (!patient) return context.redirect(`${recordsBase}?fout=dossier_niet_gevonden`);
  const staff = patient.canManageAssignments ? await getPatientStaff() : [];
  const matchingCustomerAccounts = patient.canManageAssignments && !patient.customerUserId && patient.email
    ? (await listUnlinkedCustomerAccounts(user, patient.email)).filter((account) => account.email?.toLowerCase() === patient.email?.toLowerCase())
    : [];
  const canWrite = hasPermission(user, 'client_records.write');
  const activeAssignments = patient.assignments.filter((item) => !item.endedAt);
  const assignedIds = new Set(activeAssignments.map((item) => item.userId));
  const correctionId = context.url.searchParams.get('correctie') || '';
  const correctionTarget = patient.notes.find((note) => note.id === correctionId && note.status === 'final') || null;
  const message = context.url.searchParams.get('melding') || '';
  const errorCode = context.url.searchParams.get('fout') || '';
  const messages: Record<string, string> = {
    gegevens: 'Cliëntgegevens opgeslagen.', aangemaakt: 'Cliëntendossier aangemaakt.', afspraak: 'Cliëntendossier aangemaakt en afspraak gekoppeld.', account_gekoppeld: 'Klantaccount aan dit dossier gekoppeld.',
    concept: 'Verslag als concept opgeslagen.', definitief: 'Verslag definitief opgeslagen.', toegewezen: 'Cliënt toegewezen.',
    toewijzing_beeindigd: 'Toewijzing beëindigd.', afspraak_gekoppeld: 'Afspraak aan het dossier gekoppeld.', gearchiveerd: 'Dossier gearchiveerd.', hersteld: 'Dossier hersteld en weer actief.',
  };
  const errors: Record<string, string> = {
    ongeldige_invoer: 'Controleer de datum, titel en inhoud van het verslag.', dossier_niet_gevonden: 'Dit dossier bestaat niet of is niet aan jouw account toegewezen.',
    versieconflict: 'Dit concept is intussen gewijzigd. Herlaad het dossier en controleer de nieuwste versie voordat je opnieuw opslaat.',
    dossier_gearchiveerd: 'Dit dossier is gearchiveerd. Herstel het dossier als superadmin om nieuwe verslagen te kunnen toevoegen.',
    afspraak_niet_gekoppeld: 'Koppel de afspraak eerst aan dit dossier voordat je het verslag opslaat.',
    correctie_niet_geldig: 'De gekozen correctie hoort niet bij dit dossier of is nog geen definitief verslag.',
    concept_niet_bewerkbaar: 'Alleen de auteur van dit concept en superadmins kunnen het bewerken.',
    verslag_niet_opgeslagen: 'Het verslag kon niet worden opgeslagen. Een definitief verslag kan alleen met een aanvullend verslag worden gecorrigeerd.',
    toewijzing_mislukt: 'De toewijzing kon niet worden bijgewerkt.', afspraak_koppelen_mislukt: 'De afspraak kon niet worden gekoppeld.',
    afspraak_al_gekoppeld: 'Deze afspraak is inmiddels aan een ander dossier gekoppeld.', archiveren_mislukt: 'Het dossier kon niet worden gearchiveerd.',
    afspraak_klopt_niet: 'De naam, het e-mailadres of het klantaccount van deze afspraak komt niet overeen met dit dossier.',
    klantaccount_al_gekoppeld: 'Dit klantaccount is al aan een ander cliëntendossier gekoppeld.',
    account_komt_niet_overeen: 'Het e-mailadres van het klantaccount komt niet overeen met dit dossier.',
    account_koppelen_mislukt: 'Het klantaccount kon niet worden gekoppeld.',
  };
  const formatDate = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium' }).format(new Date(value));
  const formatDateTime = (value: string) => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const formatLocalNow = () => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value || '00';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  };
  const noteLabel = (value: string) => noteTypeLabels[value as keyof typeof noteTypeLabels] || 'Verslag';
  const statusLabel: Record<string, string> = { pending: 'Aangevraagd', confirmed: 'Bevestigd', completed: 'Afgerond', no_show: 'Niet verschenen', cancelled: 'Geannuleerd', declined: 'Afgewezen' };
  const bookingId = context.url.searchParams.get('boeking') || '';
  const selectedBooking = patient.linkableBookings.find((item) => item.id === bookingId);
  const contextBooking = bookingId && !patient.bookings.some(item => item.id === bookingId)
    ? await getBookingForNote(user, patientId, bookingId) : null;
  const noteBooking = patient.bookings.find(item => item.id === bookingId) || contextBooking;
  const noteBookings = contextBooking ? [contextBooking, ...patient.bookings] : patient.bookings;
  const overview = [
   ['Voornaam',patient.details.first_name],['Achternaam',patient.details.last_name],
   ['Geboortedatum',patient.details.birth_date?formatDate(patient.details.birth_date):''],
   ['Geslacht',genderLabels[patient.details.gender]],['Aanhef',patient.details.salutation],
   ['Intakedatum',patient.details.intake_date?formatDate(patient.details.intake_date):''],
   ['Adres',[`${patient.details.street} ${patient.details.house_number}${patient.details.address_box?` bus ${patient.details.address_box}`:''}`.trim(),`${patient.details.postal_code} ${patient.details.city}`.trim(),patient.details.country].filter(Boolean).join(', ')],
   ['Mobiel telefoonnummer',patient.details.mobile],['E-mailadres',patient.details.email],
   ['Reden van aanmelding',patient.details.registration_reason],['Doorverwijzer',patient.details.referrer],
  ];

  return { user, patient, detailsError, submittedDetails, bookingStatus, bookingFrom, bookingTo, staff, matchingCustomerAccounts, canWrite, assignedIds, correctionTarget, message, errorCode, messages, errors, formatDate, formatDateTime, formatLocalNow, noteLabel, statusLabel, bookingId, selectedBooking, overview, practice, recordsBase, noteBooking, noteBookings };
}
export type ClientDetailData = Exclude<Awaited<ReturnType<typeof loadClientDetailPage>>, Response>;
