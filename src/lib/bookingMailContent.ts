export type BookingMailPayload={name:string;salutation?:string;appointment:string;practitioner:string;startsAt:string;endsAt:string;channel:string;location?:string;instructions?:string};
export function bookingMailContent(kind:string,p:BookingMailPayload){
 const when=new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',dateStyle:'full',timeStyle:'short'}).format(new Date(p.startsAt));
 const label=kind==='cancelled'?'geannuleerd':kind==='rescheduled'?'verplaatst':'bevestigd';
 const greeting=p.salutation?`Geachte ${p.salutation} ${p.name},`:`Beste ${p.name},`;
 return {subject:`Afspraak ${label}: ${p.appointment} — MyGrowise`,text:`${greeting}\n\nJe afspraak is ${label}.\n\nAfspraak: ${p.appointment}\nTherapeut: ${p.practitioner}\nWanneer: ${when} (Belgische tijd)\n${p.channel==='online'?'Online sessie':`Locatie: ${p.location||'Neem contact op met de praktijk'}`}\n${kind!=='cancelled'&&p.instructions?`\n${p.instructions}\n`:''}\nJe vindt je afspraken in je MyGrowise-account. Voor praktische vragen kan je antwoorden op deze mail.\n\nMet vriendelijke groet,\nMyGrowise`};
}
