import { noteDocumentText } from '../../src/lib/noteDocument';
import type { ClientDetailData } from '../../src/lib/clientDetailPage';
import { recordWorkspace } from '../../src/lib/clientRecordWorkspace';
import { patientFields } from '../../src/lib/patientDetails';

/** Synthetic data only. No database calls or clinical records are used by browser QA. */
export function recordFixture(url: URL) {
  const practice=url.pathname.includes('record-practice-fixture');
  const readOnly=url.searchParams.has('readonly');
  const state=recordWorkspace(url);
  const user={sub:'11111111-1111-4111-8111-111111111111',name:'Testmedewerker',email:'test@example.invalid',roles:readOnly?['practitioner']:['super_admin'],practitionerId:practice?'33333333-3333-4333-8333-333333333333':null};
  const now='2026-11-18T10:00:00Z';
  const details={...Object.fromEntries(patientFields.map(([key])=>[key,''])),first_name:'Anne-Sophie',last_name:'Van den Berg',birth_date:'1988-02-29',gender:'female',country:'BE',mobile:'+32 470 12 34 56',email:'anne.sophie@example.invalid',registration_reason:'Synthetisch dossier voor visuele en functionele controle.'};
  const notes=url.searchParams.has('empty')?[]:[
    {id:'22222222-2222-4222-8222-222222222222',type:'session',status:'draft',title:'Sessie — ruimte voor herstel',body:'Synthetisch verslag voor de interfacecontrole.\n\nWe bespraken hoe dagelijkse spanning wordt ervaren en welke momenten ruimte geven voor herstel. De cliënt wil bewuster stilstaan bij grenzen en een haalbaar ritme.\n\nAfgesproken om de komende week één rustmoment per dag te plannen. In het volgende gesprek kijken we samen wat dit heeft opgeleverd.'},
    {id:'33333333-3333-4333-8333-333333333333',type:'intake',status:'final',title:'Intake — hulpvraag en verwachtingen',body:'Synthetische inhoud. Eerste verkenning van de hulpvraag en verwachtingen.\n\nWe hebben de werkwijze besproken en afspraken gemaakt over het vervolg.'},
    {id:'44444444-4444-4444-8444-444444444444',type:'follow_up',status:'final',title:'Opvolging — grenzen herkennen en bespreekbaar maken',body:'Synthetische inhoud voor de browsercontrole.'},
  ].map((item,index)=>({...item,bookingId:null,currentVersion:2,createdBy:user.sub,createdAt:now,updatedAt:now,occurredAt:`2026-11-${18-index*3}T10:00:00Z`,finalizedAt:item.status==='final'?now:null,correctsNoteId:null,correctsNoteTitle:null,current:{versionNumber:2,title:item.title,body:item.body,createdBy:user.sub,createdAt:now},versions:url.searchParams.get('geschiedenis')===item.id?[{versionNumber:1,title:'Eerste versie',body:'Synthetische eerdere versie.',createdAt:now,createdBy:user.sub}]:[]}));
  if(url.searchParams.has('rich')) {
    const document={type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Opvolging'}]},{type:'paragraph',content:[{type:'text',text:'We bespraken '},{type:'text',text:'herstel en grenzen',marks:[{type:'bold'}]},{type:'text',text:' in het dagelijks leven.'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Elke dag een haalbaar rustmoment.'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Ervaringen bespreken in het volgende gesprek.',marks:[{type:'italic'}]}]}]}]}]};
    for(const note of notes) {
      Object.assign(note.current,{document,body:noteDocumentText(document)});
      for(const version of note.versions) {const document={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Eerder vastgelegd',marks:[{type:'bold'}]}]}]};Object.assign(version,{document,body:noteDocumentText(document)});}
    }
  }
  const patient={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',fullName:url.searchParams.has('long')?'Anne-Sophie Van den Berg-Vandenbroecke met een uitzonderlijk lange familienaam':'Anne-Sophie Van den Berg',email:details.email,status:url.searchParams.has('archived')?'archived':'active',createdAt:now,updatedAt:now,details,customerUserId:null,linkedCustomer:null,canManageAssignments:!readOnly,canArchive:!readOnly,notes,noteCount:notes.length,notePage:Number(url.searchParams.get('pagina')||1),notePageCount:2,bookingCount:2,bookingPage:1,bookingPageCount:2,bookingFilterCount:2,bookings:[{id:'booking',startsAt:now,endsAt:'2026-11-18T10:50:00Z',status:'completed',practitionerName:'Virginie',appointmentName:'Individuele begeleiding'}],linkableBookings:[],assignments:[{id:'assignment',userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Virginie',assignedAt:now,endedAt:null},{id:'ended',userId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Vorige medewerker',assignedAt:now,endedAt:now}]};
  const formatDate=(value:string)=>new Intl.DateTimeFormat('nl-BE',{dateStyle:'medium',timeZone:'Europe/Brussels'}).format(new Date(value));
  const formatDateTime=(value:string)=>new Intl.DateTimeFormat('nl-BE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Brussels'}).format(new Date(value));
  const correctionTarget=notes.find(note=>note.id===url.searchParams.get('correctie'))||null;
  const data={...state,selectedNoteId:state.note,practice,recordsBase:practice?'/record-practice-fixture':'/record-workspace-fixture',user,patient,canWrite:!readOnly,submittedNote:null,noteError:'',detailsError:'',submittedDetails:null,deletionBlocker:'Archiveer het dossier eerst.',staff:[{id:'new-staff',name:'Nieuwe medewerker',roles:['employee']}],assignedIds:new Set(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']),matchingCustomerAccounts:[],bookingStatus:url.searchParams.get('status')||'',bookingFrom:url.searchParams.get('van')||'',bookingTo:url.searchParams.get('tot')||'',bookingId:'',selectedBooking:null,noteBooking:null,noteBookings:patient.bookings,correctionTarget,message:url.searchParams.get('melding')||'',messages:{concept:'Verslag als concept opgeslagen.',definitief:'Verslag definitief opgeslagen.'},errorCode:'',errors:{},formatDate,formatDateTime,formatLocalNow:()=> '2026-11-18T11:00',noteLabel:(type:string)=>({session:'Sessie',intake:'Intake',follow_up:'Opvolging',correction:'Aanvulling / correctie'}[type]||'Verslag'),statusLabel:{confirmed:'Bevestigd',completed:'Afgerond'},overview:[['Voornaam',details.first_name],['Achternaam',details.last_name],['Geboortedatum','29 feb 1988 (38 jaar)'],['Mobiel telefoonnummer',details.mobile],['E-mailadres',details.email],['Reden van aanmelding',details.registration_reason]]};
  return data as unknown as ClientDetailData;
}
