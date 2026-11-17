export type AppointmentChoice = {id:string;practitionerId:string;practitionerName:string;name:string;duration:number;channel?:string;location:string};
const collator = new Intl.Collator('nl-BE', {sensitivity:'base',numeric:true});
export function appointmentTherapists(offers: AppointmentChoice[]) {
 return [...new Map(offers.map(o=>[o.practitionerId,{id:o.practitionerId,name:o.practitionerName}])).values()].sort((a,b)=>collator.compare(a.name,b.name));
}
export function appointmentChoices(offers: AppointmentChoice[], practitionerId: string) {
 return offers.filter(o=>o.practitionerId===practitionerId).sort((a,b)=>collator.compare(a.name,b.name)||a.duration-b.duration||collator.compare(a.channel||a.location,b.channel||b.location)||a.id.localeCompare(b.id));
}
export function initialPractitioner(offers: AppointmentChoice[], requested = '') {
 const people = appointmentTherapists(offers);
 return people.some(p=>p.id===requested) ? requested : people.length===1 ? people[0].id : '';
}
