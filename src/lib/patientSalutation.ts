/** Stable storage values, shared by forms, records and queued mail. */
export const salutationLabels: Record<string, string> = {
 '': 'Geen aanhef', heer: 'Heer', meneer: 'Meneer', mevrouw: 'Mevrouw',
 heer_mevrouw: 'Heer/mevrouw', guardians: 'Ouder(s)/verzorger(s) van', couple: 'Echtpaar',
};
export function patientGreeting(name: string, salutation = ''): string {
 const label = Object.hasOwn(salutationLabels,salutation) ? salutationLabels[salutation] : '';
 if (!label || !salutation) return `Beste ${name},`;
 if (salutation === 'couple') return `Geacht echtpaar ${name},`;
 return `Geachte ${label.toLocaleLowerCase('nl-BE')} ${name},`;
}
