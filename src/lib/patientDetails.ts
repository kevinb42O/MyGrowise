export const patientFields = [
 ['first_name','Voornaam',60],['last_name','Achternaam',60],['birth_date','Geboortedatum',10],
 ['gender','Geslacht',20],['salutation','Aanhef',20],['intake_date','Intakedatum',10],
 ['street','Straat',150],['house_number','Huisnummer',20],['address_box','Bus',20],
 ['postal_code','Postcode',20],['city','Gemeente',100],['country','Landcode',2],
 ['mobile','Mobiel telefoonnummer',35],['email','E-mailadres',254],
 ['registration_reason','Reden van aanmelding',3000],['referrer','Doorverwijzer',300],
] as const;
export type PatientField = typeof patientFields[number][0];
export type PatientDetails = Record<PatientField,string>;
export const genderLabels: Record<string,string> = {'':'Niet opgegeven',female:'Vrouw',male:'Man',other:'Anders',unspecified:'Zeg ik liever niet'};
export const parsePatientDetails = (input: Record<string,unknown>, booking=false): PatientDetails => {
 const result = Object.fromEntries(patientFields.map(([key,,max])=>{
   let value=String(input[key]??'').trim();
   if(key==='country') value=(value||'BE').toUpperCase();
   if(value.length>max) throw new Error('Controleer de lengte van de ingevulde gegevens.');
   return [key,value];
 })) as PatientDetails;
 if(!result.first_name||!result.last_name||`${result.first_name} ${result.last_name}`.length>120) throw new Error('Vul voornaam en achternaam in.');
 for(const key of ['birth_date','intake_date'] as const) {
   const value=result[key];
   if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))) throw new Error('Controleer de ingevulde datum.');
 }
 if(!Object.hasOwn(genderLabels,result.gender)||!['','mevrouw','meneer','heer'].includes(result.salutation)) throw new Error('Controleer geslacht en aanhef.');
 if(!/^[A-Z]{2}$/.test(result.country)) throw new Error('Controleer de landcode.');
 if(result.mobile&&(!/^\+?[0-9\s().-]+$/.test(result.mobile)||result.mobile.replace(/\D/g,'').length<6)) throw new Error('Vul een geldig mobiel telefoonnummer in.');
 if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Vul een geldig e-mailadres in.');
 if(booking&&(!result.birth_date||!result.mobile)) throw new Error('Vul je geboortedatum en mobiel nummer in.');
 return result;
};
