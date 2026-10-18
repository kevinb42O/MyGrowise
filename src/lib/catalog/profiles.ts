export const profileThemes = ['Persoonlijkheid', 'Stress en emoties', 'Werk en loopbaan', 'Prikkelverwerking', 'Ingrijpende ervaringen', 'Emotioneel welzijn'] as const;
export const profileAges = { children: '8–13 jaar', adolescents: '14–17 jaar', adults: '18 jaar en ouder' } as const;
export type ProfileLanding = {
  schemaVersion: 1; question: string; introduction: string[]; measures: string[];
  instrumentLines: string[]; expectations: string[]; disclaimer: string;
  formatLabel: string; reportLabel: string; ageMin: number; ageMax: number | null;
  themes: string[]; instrumentCount: number; ownCount: number;
};
const textLimits = {question: 320, disclaimer: 2000, formatLabel: 120, reportLabel: 120};
const lists = ['introduction', 'measures', 'instrumentLines', 'expectations'] as const;
const keys = ['schemaVersion', ...Object.keys(textLimits), ...lists, 'ageMin', 'ageMax', 'themes', 'instrumentCount', 'ownCount'];
export function parseProfileLanding(value: unknown): ProfileLanding | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const c = value as Record<string, unknown>;
  if (Object.keys(c).length !== keys.length || Object.keys(c).some(k => !keys.includes(k)) || c.schemaVersion !== 1) return null;
  for (const [key, max] of Object.entries(textLimits)) if (typeof c[key] !== 'string' || !(c[key] as string).trim() || (c[key] as string).length > max) return null;
  for (const key of lists) if (!Array.isArray(c[key]) || !c[key].length || c[key].length > 24 || c[key].some(line => typeof line !== 'string' || !line.trim() || line.length > 2000)) return null;
  if (!Number.isInteger(c.ageMin) || Number(c.ageMin) < 0 || Number(c.ageMin) > 120 || c.ageMax !== null && (!Number.isInteger(c.ageMax) || Number(c.ageMax) < Number(c.ageMin) || Number(c.ageMax) > 120)) return null;
  if (!Number.isInteger(c.instrumentCount) || Number(c.instrumentCount) < 1 || Number(c.instrumentCount) > 30 || !Number.isInteger(c.ownCount) || Number(c.ownCount) < 0 || Number(c.ownCount) > 10) return null;
  if (!Array.isArray(c.themes) || !c.themes.length || new Set(c.themes).size !== c.themes.length || c.themes.some(t => !profileThemes.includes(t as typeof profileThemes[number]))) return null;
  return c as ProfileLanding;
}
export function profileMatchesAge(c: Pick<ProfileLanding,'ageMin'|'ageMax'> | null, age: string): boolean {
  if (!age) return true;
  if (!c) return false;
  const range = age === 'children' ? [8, 13] : age === 'adolescents' ? [14, 17] : age === 'adults' ? [18, 120] : null;
  return Boolean(range && c.ageMin <= range[1] && (c.ageMax ?? 120) >= range[0]);
}
export const profileCountLabel = (c: Pick<ProfileLanding,'instrumentCount'|'ownCount'>) => `${c.instrumentCount} vragenlijsten${c.ownCount ? ` + ${c.ownCount} eigen MyGrowise-onderdeel` : ''}`;
export function profileFieldsFromForm(form: FormData) {
  if (form.get('profileFieldsPresent') !== '1') return {};
  const text = (k: string) => String(form.get(`profile-${k}`) || '').trim();
  if (![...Object.keys(textLimits), ...lists].some(text)) return {profileLanding: null};
  const content: Record<string, unknown> = {schemaVersion: 1};
  for (const key of Object.keys(textLimits)) content[key] = text(key);
  for (const key of lists) content[key] = text(key).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const key of ['ageMin', 'instrumentCount', 'ownCount']) content[key] = text(key) ? Number(text(key)) : NaN;
  content.ageMax = text('ageMax') ? Number(text('ageMax')) : null;
  content.themes = form.getAll('profile-theme').map(String);
  const profileLanding = parseProfileLanding(content);
  if (!profileLanding) throw new Error('Vul alle profielvelden, geldige leeftijden, aantallen en minstens één thema in. Maximaal 24 regels per tekstvak en 2000 tekens per regel.');
  return {profileLanding};
}
