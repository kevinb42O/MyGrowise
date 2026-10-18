import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';

const hash = value => createHash('sha256').update(value).digest('hex');
const fail = () => { throw new Error('Unsupported or invalid MijnDiAd calendar; nothing imported.'); };
const text = value => (value || '').replace(/\\([nN,;\\])/g, (_, char) => /[nN]/.test(char) ? ' ' : char).replace(/\s+/g, ' ').trim();

export function mijndiadAppointmentUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://praktijkitransform.mijndiad.nl'
      && /^\/appointments\/\d+$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

function instant(property) {
  if (!property) return fail();
  const { name, value } = property;
  if (!/^\d{8}T\d{6}Z?$/.test(value)) return fail();
  const tzid = /;TZID=(?:"([^"]+)"|([^;]+))/.exec(name);
  const zone = value.endsWith('Z') ? 'UTC' : tzid?.[1] || tzid?.[2];
  if (!zone) return fail();
  const date = DateTime.fromFormat(value.replace(/Z$/, ''), "yyyyMMdd'T'HHmmss", { zone });
  // Reject impossible local times, including the spring DST gap.
  if (!date.isValid || date.toFormat("yyyyMMdd'T'HHmmss") !== value.replace(/Z$/, '')) return fail();
  const choices = date.getPossibleOffsets();
  if (choices.length > 1 && !value.endsWith('Z')) return fail();
  return date.toUTC().toISO();
}

/** Strict snapshot importer for the observed MijnDiAd feed, not a general ICS engine.
 * Unknown recurrence/all-day formats fail closed so no appointment is silently lost.
 * Retains the published appointment type, location and validated source link.
 * Descriptions are not imported. The feed does not provide client identities.
 */
export function parseMijndiadCalendar(input, practitionerId) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > 8_000_000) return fail();
  const lines = input.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '').trim().split(/\r?\n/);
  if (lines[0] !== 'BEGIN:VCALENDAR' || lines.at(-1) !== 'END:VCALENDAR') return fail();
  let fields = null;
  const events = new Map();
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { if (fields) return fail(); fields = new Map(); continue; }
    if (line === 'END:VEVENT') {
      if (!fields) return fail();
      if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID', 'DURATION'].some(key => fields.has(key))) return fail();
      const uid = fields.get('UID')?.value;
      if (!uid?.trim() || uid.length > 2048) return fail();
      const startsAt = instant(fields.get('DTSTART'));
      const endsAt = instant(fields.get('DTEND'));
      if (Date.parse(endsAt) <= Date.parse(startsAt)) return fail();
      const status = fields.get('STATUS')?.value || 'CONFIRMED';
      if (!['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(status)) return fail();
      const externalUid = hash(uid);
      const title = text(fields.get('SUMMARY')?.value).replace(/^Bezet\s*[-–—:]\s*/i, '') || 'Afspraak MijnDiAd';
      const location = text(fields.get('LOCATION')?.value);
      if (title.length > 100 || location.length > 120) return fail();
      const kind = /^(privé|supervisie|teamvergadering|intervisie|administratie|opleiding)(?:\s|$)/i.test(title) ? 'personal'
        : /^(verlof|vakantie|pauze|niet beschikbaar)$/i.test(title) ? 'block' : 'appointment';
      const online = /\bonline\b/i.test(`${title} ${location}`);
      const hex = hash(`mijndiad:${practitionerId}:${uid}`).slice(0, 32).split('');
      hex[12] = '5'; hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
      const id = hex.join('').replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
      const event = { id, externalUid, startsAt, endsAt, title, location, kind,
        color: kind !== 'appointment' ? '#687985' : online ? '#326b9e' : '#b6506e',
        externalUrl: mijndiadAppointmentUrl(fields.get('URL')?.value),
        status: status === 'CANCELLED' || fields.get('TRANSP')?.value === 'TRANSPARENT' ? 'cancelled' : 'confirmed' };
      if (events.has(externalUid)) return fail();
      events.set(externalUid, event); fields = null; continue;
    }
    if (!fields) continue;
    if (line.startsWith('BEGIN:') || line.startsWith('END:')) return fail();
    const colon = line.indexOf(':');
    if (colon < 1) return fail();
    const name = line.slice(0, colon); const key = name.split(';')[0];
    if (fields.has(key)) return fail();
    fields.set(key, { name, value: line.slice(colon + 1) });
  }
  if (fields || !events.size) return fail();
  return [...events.values()];
}

export async function fetchMijndiadCalendar(url, practitionerId) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'praktijkitransform.mijndiad.nl'
    || !/^\/public\/ical\/[a-f0-9]+\.ics$/.test(parsed.pathname) || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('Expected the private Praktijk Itransform MijnDiAd iCal URL.');
  }
  let response;
  try { response = await fetch(parsed, { signal: AbortSignal.timeout(20_000), redirect: 'error' }); }
  catch { throw new Error('MijnDiAd feed could not be fetched; existing appointments preserved.'); }
  if (!response.ok || !/text\/calendar/i.test(response.headers.get('content-type') || '')) {
    throw new Error('MijnDiAd did not return a calendar; existing appointments preserved.');
  }
  let content = ''; let length = 0;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    length += chunk.length; if (length > 8_000_000) return fail();
    content += decoder.decode(chunk, { stream: true });
  }
  return parseMijndiadCalendar(content + decoder.decode(), practitionerId);
}
