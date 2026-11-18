export const recordSections = ['verslagen', 'afspraken', 'gegevens', 'toegang'] as const;
export type RecordSection = typeof recordSections[number];

/** Explicit sections win over inferred context from old links and form redirects. */
export function recordWorkspace(url: URL) {
  const params = url.searchParams;
  const requested = params.get('onderdeel');
  let section: RecordSection = recordSections.includes(requested as RecordSection) ? requested as RecordSection : 'verslagen';
  let note = params.get('verslag') || params.get('concept') || params.get('geschiedenis') || '';
  if (!requested) {
    const message = params.get('melding') || '';
    const error = params.get('fout') || '';
    if (['gegevens', 'account_gekoppeld'].includes(message) || error.startsWith('account_') || error === 'klantaccount_al_gekoppeld') section = 'gegevens';
    if (['toegewezen', 'toewijzing_beeindigd', 'gearchiveerd', 'hersteld'].includes(message) || ['toewijzing_mislukt', 'archiveren_mislukt'].includes(error)) section = 'toegang';
    if (params.has('afsprakenpagina') || params.has('status') || params.has('van') || params.has('tot')) section = 'afspraken';
    if (params.has('correctie') || params.has('boeking')) note = 'nieuw';
  }
  const hash = url.hash;
  if (!requested && hash) {
    if (hash === '#clientgegevens') section = 'gegevens';
    else if (hash === '#afspraken') section = 'afspraken';
    else if (hash === '#nieuw-verslag') { section = 'verslagen'; note = 'nieuw'; }
    else if (hash.startsWith('#verslag-')) { section = 'verslagen'; note = hash.slice(9); }
  }
  return { section, note };
}

export function recordHref(base: string, section: RecordSection, values: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams({ onderdeel: section });
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value));
  return `${base}?${params}`;
}
