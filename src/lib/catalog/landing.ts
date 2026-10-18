export const audienceGroupLabels = {
  children: 'Kinderen',
  adolescents: 'Jongeren',
  adults: 'Volwassenen',
} as const;
export type AudienceGroup = keyof typeof audienceGroupLabels;

export type QuestionnaireLandingContent = {
  schemaVersion: 1;
  question: string;
  introduction: string[];
  measures: string[];
  expectations: string[];
  disclaimer: string;
  respondentLabel: string;
  formatLabel: string;
  reportLabel: string;
};

const textLimits = { question: 320, disclaimer: 2000, respondentLabel: 240, formatLabel: 120, reportLabel: 120 } as const;
const listLimits = { introduction: 12, measures: 24, expectations: 12 } as const;
const contentKeys = ['schemaVersion', ...Object.keys(textLimits), ...Object.keys(listLimits)];

/** Validate at the boundary; do not silently publish partially malformed content. */
export function parseLandingContent(value: unknown): QuestionnaireLandingContent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 || Object.keys(data).length !== contentKeys.length || Object.keys(data).some(key => !contentKeys.includes(key))) return null;
  for (const [key, limit] of Object.entries(textLimits)) {
    const text = data[key];
    if (typeof text !== 'string' || !text.trim() || text.length > limit) return null;
  }
  for (const [key, limit] of Object.entries(listLimits)) {
    const lines = data[key];
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > limit || lines.some(line => typeof line !== 'string' || !line.trim() || line.length > 2000)) return null;
  }
  return data as QuestionnaireLandingContent;
}

export function parseAudienceGroups(value: unknown): AudienceGroup[] | null {
  if (!Array.isArray(value) || value.length > 3 || new Set(value).size !== value.length || value.some(group => typeof group !== 'string' || !Object.hasOwn(audienceGroupLabels, group))) return null;
  return value as AudienceGroup[];
}

/** Legacy products keep their old filter behavior until explicitly classified. */
export function matchesAudience(product: { audience: string; audienceGroups?: AudienceGroup[] }, group: string): boolean {
  if (!group) return true;
  if (!Object.hasOwn(audienceGroupLabels, group)) return false;
  if (product.audienceGroups?.length) return product.audienceGroups.includes(group as AudienceGroup);
  return product.audience.toLowerCase().includes(audienceGroupLabels[group as AudienceGroup].toLowerCase());
}

/** A marker distinguishes a new editor submission from older integrations. */
export function landingFieldsFromForm(form: FormData) {
  if (form.get('landingFieldsPresent') !== '1') return {};
  const audienceGroups = parseAudienceGroups(form.getAll('audienceGroup'));
  if (!audienceGroups) throw new Error('Kies geldige doelgroepen zonder dubbels.');
  const text = (key: string) => String(form.get(key) || '').trim();
  const keys = [...Object.keys(textLimits), ...Object.keys(listLimits)];
  const hasContent = keys.some(key => text(`landing-${key}`));
  if (!hasContent) return { landingContent: null, audienceGroups };
  const content: Record<string, unknown> = { schemaVersion: 1 };
  for (const key of Object.keys(textLimits)) content[key] = text(`landing-${key}`);
  for (const key of Object.keys(listLimits)) content[key] = text(`landing-${key}`).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const landingContent = parseLandingContent(content);
  if (!landingContent) throw new Error('Vul alle landingspaginavelden in. Gebruik maximaal 12 introductie- en verwachtingsalinea’s, 24 meetdomeinen en 2000 tekens per alinea of lijstpunt.');
  if (!audienceGroups.length) throw new Error('Kies minstens één doelgroep voor deze landingspagina.');
  return { landingContent, audienceGroups };
}
