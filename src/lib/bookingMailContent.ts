import {renderEmail,emailUrl} from './emailTemplate.ts';
export type BookingMailPayload={name:string;salutation?:string;appointment:string;practitioner:string;startsAt:string;endsAt:string;channel:string;location?:string;instructions?:string};
export function bookingMailContent(kind:string,p:BookingMailPayload,origin='https://www.mygrowise.be'){
 const when=new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',dateStyle:'full',timeStyle:'short'}).format(new Date(p.startsAt));
 const label=kind==='cancelled'?'geannuleerd':kind==='rescheduled'?'verplaatst':'bevestigd';
 const greeting=p.salutation?`Geachte ${p.salutation} ${p.name},`:`Beste ${p.name},`;
 const cancelled=kind==='cancelled';
 const title=cancelled?'Je afspraak is geannuleerd.':kind==='rescheduled'?'Je nieuwe moment staat vast.':'Je afspraak staat vast.';
 const intro=cancelled?'Je afspraak is geannuleerd. Je hoeft voor dit moment niets meer te doen. Wil je een nieuw moment plannen? Bekijk de beschikbare afspraken in je account.':kind==='rescheduled'?'Je afspraak is verplaatst. Hieronder vind je het nieuwe moment; het eerdere tijdstip is vervallen.':'Je afspraak is bevestigd. Hieronder vind je alle praktische gegevens, zodat je rustig kunt voorbereiden.';
 const account=`${(emailUrl(origin)||'https://www.mygrowise.be').replace(/\/$/,'')}/account/begeleiding`;
 const time=new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit'});
 const date=new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',dateStyle:'full'}).format(new Date(p.startsAt));
 const format=p.channel==='online'?'Online sessie':p.location||'Neem contact op met de praktijk';
 const sections=!cancelled&&p.instructions?[{title:'Praktisch voor je sessie',body:p.instructions}]:[];
 const note='Voor praktische vragen kun je op deze e-mail antwoorden. Je vindt de actuele afspraakgegevens en beschikbare acties altijd in je MyGrowise-account.';
 return {
  subject:`Afspraak ${label}: ${p.appointment} — MyGrowise`,
  text:`${greeting}\n\n${intro}\n\nAfspraak: ${p.appointment}\nTherapeut: ${p.practitioner}\nWanneer: ${when} (Belgische tijd)\nEinde: ${time.format(new Date(p.endsAt))}\n${format}\n${!cancelled&&p.instructions?`\n${p.instructions}\n`:''}\nBekijk je afspraken: ${account}\n\n${note}\n\nMet warme groet,\nHet MyGrowise-team`,
  html:renderEmail({title,preheader:`Je afspraak is ${label}. Bekijk de praktische gegevens.`,greeting,paragraphs:[intro],details:[['Afspraak',p.appointment],['Therapeut',p.practitioner],['Datum',date],['Tijd',`${time.format(new Date(p.startsAt))} – ${time.format(new Date(p.endsAt))} (Belgische tijd)`],['Vorm / locatie',format]],action:{label:cancelled?'Bekijk mijn afspraken':'Bekijk mijn afspraak',url:account},sections,note}),
 };
}
