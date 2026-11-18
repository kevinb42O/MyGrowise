/** Fold names without interpreting user input as a regular expression or HTML. */
export const foldSearchText = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function highlightedParts(text: string, query: string): { text: string; match: boolean }[] {
  const tokens = foldSearchText(query).trim().split(/\s+/).filter(Boolean);
  const points = Array.from(text);
  const folded = points.map(foldSearchText);
  const haystack = folded.join('');
  const matches = new Set<number>();
  for (const token of tokens) {
    let start = haystack.indexOf(token);
    while (start >= 0) {
      for (let i = start; i < start + token.length; i++) matches.add(i);
      start = haystack.indexOf(token, start + token.length);
    }
  }
  const parts: { text: string; match: boolean }[] = [];
  let offset = 0;
  points.forEach((point, index) => {
    const match = Array.from({ length: folded[index].length }, (_, i) => offset + i).some(i => matches.has(i));
    offset += folded[index].length;
    const last = parts.at(-1);
    if (last?.match === match) last.text += point;
    else parts.push({ text: point, match });
  });
  return parts;
}
