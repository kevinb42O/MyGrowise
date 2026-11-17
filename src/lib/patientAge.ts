export function brusselsToday(now = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}
export function validCalendarDate(value: string): boolean {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
 const date = new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
/** A leap-day birthday advances on March 1 in a non-leap year. */
export function patientAge(birthDate: string, today = brusselsToday()): number | null {
 if (!validCalendarDate(birthDate) || !validCalendarDate(today) || birthDate > today) return null;
 return Number(today.slice(0,4)) - Number(birthDate.slice(0,4)) - (today.slice(5) < birthDate.slice(5) ? 1 : 0);
}
export function patientAgeLabel(birthDate: string, today = brusselsToday()): string {
 const age = patientAge(birthDate,today);
 return age === null ? '' : `${age} jaar`;
}
