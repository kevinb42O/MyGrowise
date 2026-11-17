import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import luxon3Plugin from '@fullcalendar/luxon3';
import nlLocale from '@fullcalendar/core/locales/nl';
import type { DatesSetArg, EventApi, EventChangeArg, EventInput } from '@fullcalendar/core';
import { fromBrusselsLocalInput, toBrusselsLocalInput } from '../../lib/brusselsTime';
import AgendaClientPicker from './AgendaClientPicker';
import AgendaDialog from './AgendaDialog';

type Source = 'mygrowise' | 'itransform' | 'block' | 'availability';
type Mode = 'admin' | 'practice';
type Item = {
  id: string; source: Source; title: string; subtitle: string; startsAt: string; endsAt: string; status: string;
  kind: 'appointment' | 'personal' | 'block' | 'availability'; location: string; color: string; editable: boolean;
  practitionerId?: string | null; practitionerName?: string; patientId?: string | null; externalSource?: 'mijndiad' | null; externalUrl?: string | null;
  revision?: string; conflict?: boolean; offerIds?: string[];
};
type CalendarRange = { from: string; to: string; date: string; view: string };
type TimeRange = { startsAt: string; endsAt: string };
type EventFields = TimeRange & { title: string; kind: 'appointment' | 'personal' | 'block'; location: string; color: string;
  practitionerId: string; calendarScope: 'mygrowise' | 'itransform'; revision?: string; id?: string };
type Offer = { id: string; name: string; duration: number; location: string };
type Editor =
  | { type: 'choose'; dates: TimeRange }
  | { type: 'detail'; item: Item }
  | { type: 'event'; fields: EventFields }
  | { type: 'block'; fields: TimeRange & { reason: string } }
  | { type: 'booking'; fields: { startsAt: string; patientId: string; offerId: string }; original?: Item };
type CalendarSync = { enabled: boolean; lastSuccessAt: string | null; lastError: string | null; pendingMissing: number;
  coverageUncertain: number; coverageUntil: string | null };
type Payload = { events: Item[]; practitioners?: { id: string; name: string; active: boolean }[];
  canUseItransform?: boolean; sync?: CalendarSync | null; availabilityUnknown?: boolean };

const plugins = [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxon3Plugin];
const zone = 'Europe/Brussels';
const dateTime = new Intl.DateTimeFormat('nl-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone });
const clockTime = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: zone });
const weekend = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: zone });
const statusLabels: Record<string, string> = {
  confirmed: 'Bevestigde afspraak', pending: 'Aanvraag', completed: 'Uitgevoerd',
  no_show: 'Niet verschenen', cancelled: 'Geannuleerd', declined: 'Geweigerd',
};
const historical = ['completed', 'no_show', 'cancelled', 'declined'];
const colours = [
  ['Roze', '#d26479'], ['Oranje', '#d97706'], ['Paars', '#7c3aed'], ['Blauw', '#2563eb'],
  ['Turkoois', '#0891b2'], ['Groen', '#15803d'], ['Grijs', '#374151'], ['Rood', '#be123c'],
];
const calendarViews = ['timeGridDay', 'timeGridWeek', 'dayGridMonth', 'listWeek'];

const localInstant = (value: string) => {
  try { return fromBrusselsLocalInput(value); }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ambiguous_time') throw new Error('Dit uur komt tweemaal voor door de wintertijd. Kies een ander uur.');
    if (message === 'nonexistent_time') throw new Error('Dit uur bestaat niet door de overgang naar zomertijd. Kies een ander uur.');
    throw new Error('Vul een geldige datum en tijd in.');
  }
};
const nextQuarter = () => new Date(Math.ceil((Date.now() + 300000) / 900000) * 900000);
const plusMinutes = (instant: string, minutes: number) => new Date(Date.parse(instant) + minutes * 60000).toISOString();
const rangeTitle = (item: TimeRange) => `${dateTime.format(new Date(item.startsAt))} – ${(toBrusselsLocalInput(item.startsAt).slice(0, 10) === toBrusselsLocalInput(item.endsAt).slice(0, 10) ? clockTime : dateTime).format(new Date(item.endsAt))}`;
const itemFromEvent = (event: EventApi) => event.extendedProps.item as Item;
const isDayBounded = (item: Item) => [item.startsAt, item.endsAt].every(value => toBrusselsLocalInput(value).endsWith('T00:00'));

export function eventForeground(hex: string) {
  const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#1f7060';
  const [r, g, b] = [1, 3, 5].map(index => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * .2126 + g * .7152 + b * .0722 >= .179 ? '#000000' : '#ffffff';
}

export function AgendaEventCard({ item, timeText, compact = false, list = false, onOpen }: {
  item: Item; timeText: string; compact?: boolean; list?: boolean; onOpen?: () => void;
}) {
  const imported = item.externalSource === 'mijndiad';
  const duration = (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000;
  const short = !compact && !list && duration > 0 && duration <= 30;
  const title = item.location?.toLowerCase() === 'online' ? item.title.replace(/\s+online$/i, '') : item.title;
  const state = item.conflict ? 'Overlap · ' : item.status === 'pending' || historical.includes(item.status) ? `${statusLabels[item.status]} · `
    : item.source === 'itransform' && !imported ? 'Itransform · ' : '';
  const context = [item.practitionerName, item.location?.split(' - ')[0], imported ? 'MijnDiAd' : ''].filter(Boolean).join(' · ');
  return <div className={`unified-agenda__event${imported ? ' is-imported' : ''}${compact ? ' is-compact' : ''}${short ? ' is-short' : ''}${short && duration < 30 ? ' is-tiny' : ''}`}
    title={[timeText, item.title, item.location, item.subtitle, imported ? 'MijnDiAd' : ''].filter(Boolean).join(' · ')}>
    {timeText && !list && <b>{timeText}</b>}
    {list && onOpen ? <button className="agenda-list-event" type="button" onClick={event => { event.stopPropagation(); onOpen(); }}>{state}{title}</button> : <span>{state}{title}</span>}
    {context && !compact && !short && <small>{context}</small>}
  </div>;
}

export function ImportedAgendaDetails({ item }: { item: Item }) {
  return <div className="practice-agenda-import-details">
    <dl><div><dt>Duur</dt><dd>{Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000)} minuten</dd></div>
      <div><dt>Locatie</dt><dd>{item.location || 'Niet opgegeven'}</dd></div>
      {item.kind === 'appointment' && <div><dt>Cliëntnaam</dt><dd>Niet meegeleverd door MijnDiAd</dd></div>}
      <div><dt>Bron</dt><dd>MijnDiAd</dd></div>
    </dl>
    {item.externalUrl && /^https:\/\/praktijkitransform\.mijndiad\.nl\/appointments\/\d+$/.test(item.externalUrl) &&
      <a className="practice-agenda-import-details__link" href={item.externalUrl} target="_blank" rel="noopener noreferrer">Open oorspronkelijke afspraak in MijnDiAd</a>}
  </div>;
}

const windowFor = (start: string | Date, end?: string, allDay = false): TimeRange => {
  // FullCalendar passes an exclusive end for an all-day selection.
  if (allDay && end && typeof start === 'string') return { startsAt: `${start.slice(0, 10)}T00:00`, endsAt: `${end.slice(0, 10)}T00:00` };
  const startsAt = toBrusselsLocalInput(start);
  const wallHourLater = new Date(Date.parse(`${startsAt}Z`) + 3600000).toISOString().slice(0, 16);
  return { startsAt, endsAt: end ? toBrusselsLocalInput(end) : wallHourLater };
};

const initialNavigation = () => {
  const parameters = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const view = parameters.get('view') || '';
  const date = parameters.get('date') || '';
  return {
    view: calendarViews.includes(view) ? view : typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches ? 'timeGridDay' : 'timeGridWeek',
    date: /^\d{4}-\d\d-\d\d$/.test(date) && Number.isFinite(Date.parse(date)) ? date : undefined,
    practitioner: /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(parameters.get('professional') || '') ? parameters.get('professional')! : 'all',
  };
};

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'De agenda kon de aanvraag niet voltooien. Probeer opnieuw.');
  return payload;
}

function displayAvailability(items: Item[]): Item[] {
  const sorted = [...items].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const merged: Item[] = [];
  for (const slot of sorted) {
    const last = merged.at(-1);
    if (!last || Date.parse(slot.startsAt) > Date.parse(last.endsAt)) merged.push({ ...slot });
    else if (Date.parse(slot.endsAt) > Date.parse(last.endsAt)) last.endsAt = slot.endsAt;
  }
  return merged;
}

function visibleHours(items: Item[]) {
  let min = 7;
  let max = 23;
  for (const item of items) {
    if (isDayBounded(item)) continue;
    const start = toBrusselsLocalInput(item.startsAt);
    const end = toBrusselsLocalInput(item.endsAt);
    min = Math.min(min, Number(start.slice(11, 13)));
    max = Math.max(max, Number(end.slice(11, 13)) + (end.endsWith(':00') ? 0 : 1));
    if (start.slice(0, 10) !== end.slice(0, 10)) { min = 0; max = 24; }
  }
  return { min: `${String(min).padStart(2, '0')}:00:00`, max: `${String(max).padStart(2, '0')}:00:00` };
}

export default function UnifiedAgenda({ mode = 'admin', allowItransform = false }: { mode?: Mode; allowItransform?: boolean }) {
  const practice = mode === 'practice';
  const endpoint = practice ? '/api/praktijk/agenda' : '/api/admin/agenda';
  const calendarRef = useRef<FullCalendar>(null);
  const [initial] = useState(initialNavigation);
  const [range, setRange] = useState<CalendarRange>();
  const [practitioner, setPractitioner] = useState(initial.practitioner);
  const [professionals, setProfessionals] = useState<NonNullable<Payload['practitioners']>>([]);
  const [source, setSource] = useState<'all' | 'mygrowise' | 'itransform'>('all');
  const [search, setSearch] = useState('');
  const [showPrivate, setShowPrivate] = useState(true);
  const [showWeekends, setShowWeekends] = useState(!practice);
  const [showInactive, setShowInactive] = useState(false);
  const [sync, setSync] = useState<CalendarSync | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [hasItransform, setHasItransform] = useState(practice && allowItransform);
  const [data, setData] = useState<{ key: string; payload: Payload }>();
  const [loadState, setLoadState] = useState<{ key: string; error?: string }>();
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState<string[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerState, setOfferState] = useState<'idle' | 'ready' | 'failed'>('idle');
  const [clock, setClock] = useState(Date.now);
  const refresh = useCallback(() => setReload(value => value + 1), []);
  const query = range ? new URLSearchParams({ from: range.from, to: range.to, ...(!practice && practitioner !== 'all' ? { practitioner } : {}) }).toString() : '';

  useEffect(() => { if (!hasItransform) setSource('all'); }, [hasItransform]);
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setLoadState(undefined);
    fetchJson(`${endpoint}?${query}`, { signal: controller.signal }).then((payload: Payload) => {
      if (controller.signal.aborted) return;
      setData({ key: query, payload });
      setLoadState({ key: query });
      setClock(Date.now());
      if (practice) { setSync(payload.sync ?? null); setHasItransform(payload.canUseItransform === true); }
      else setProfessionals(payload.practitioners || []);
    }).catch(error => {
      if (!controller.signal.aborted) setLoadState({ key: query, error: error.message });
    });
    return () => controller.abort();
  }, [endpoint, practice, query, reload]);

  useEffect(() => {
    let lastRefresh = Date.now();
    const update = () => {
      const now = Date.now();
      setClock(now);
      if (document.visibilityState === 'visible' && now - lastRefresh >= 4000) {
        lastRefresh = now;
        refresh();
      }
    };
    const timer = window.setInterval(update, practice ? 300000 : 600000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [practice, refresh]);

  useEffect(() => {
    if (!range) return;
    const url = new URL(window.location.href);
    url.searchParams.set('date', range.date);
    url.searchParams.set('view', range.view);
    if (!practice && practitioner !== 'all') url.searchParams.set('professional', practitioner);
    else url.searchParams.delete('professional');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [practice, practitioner, range]);

  const payload = data?.key === query ? data?.payload : undefined;
  const items = payload?.events;
  const { results, bookable, weekendCount } = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('nl-BE');
    const results = (items || []).filter(item => item.source !== 'availability' &&
      (source === 'all' || item.source === source || (source === 'mygrowise' && item.source === 'block')) &&
      (showPrivate || item.kind !== 'personal' && !(item.externalSource && item.kind === 'block')) &&
      (showInactive || !['cancelled', 'declined'].includes(item.status)) &&
      (!needle || `${item.title} ${item.subtitle} ${item.location}`.toLocaleLowerCase('nl-BE').includes(needle)));
    return { results, bookable: (items || []).filter(item => item.source === 'availability'),
      weekendCount: results.filter(item => ['Sat', 'Sun'].includes(weekend.format(new Date(item.startsAt)))).length };
  }, [items, source, showPrivate, showInactive, search]);
  const imported = hasItransform ? results.filter(item => item.externalSource === 'mijndiad') : [];
  const hours = useMemo(() => visibleHours(results), [results]);
  const events = useMemo<EventInput[]>(() => {
    const visible = source === 'itransform' || loadState?.error ? results : [...results, ...displayAvailability(bookable)];
    return visible.map(item => {
      const available = item.source === 'availability';
      const imported = Boolean(item.externalSource);
      const background = imported ? `${item.color}14` : item.color;
      return {
        id: `${item.source}:${item.id}`, title: item.title, start: item.startsAt, end: item.endsAt, allDay: !available && isDayBounded(item),
        editable: item.editable && Boolean(item.practitionerId) && !practice && !moves.includes(item.id),
        display: available ? 'background' : 'auto',
        classNames: [`unified-agenda__item--${item.status}`, ...(imported ? ['unified-agenda__item--imported'] : []), ...(item.conflict ? ['agenda-event-conflict'] : [])],
        backgroundColor: background, borderColor: item.color, textColor: imported ? '#233f4c' : eventForeground(item.color),
        extendedProps: { item },
      };
    });
  }, [bookable, loadState?.error, moves, practice, results, source]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const open = (next: Editor) => { setEditor(next); setDirty(false); setEditorError(''); };
  const change = (next: Editor) => { setEditor(next); setDirty(true); setEditorError(''); };
  const close = () => { setEditor(null); setDirty(false); setEditorError(''); };
  const openEvent = (dates: TimeRange, item?: Item) => open({ type: 'event', fields: item ? {
    ...dates, id: item.id, revision: item.revision, title: item.title, kind: item.kind === 'availability' ? 'personal' : item.kind, location: item.location,
    practitionerId: item.practitionerId || '', calendarScope: item.source === 'itransform' ? 'itransform' : 'mygrowise', color: item.color,
  } : { ...dates, title: '', kind: 'personal', location: '', color: source === 'itransform' ? '#d26479' : '#1f7060',
    practitionerId: professionals.some(person => person.id === practitioner && person.active) ? practitioner : '', calendarScope: source === 'itransform' ? 'itransform' : 'mygrowise' } });

  useEffect(() => {
    if (editor?.type !== 'booking' || editor.original || offerState !== 'idle') return;
    const controller = new AbortController();
    fetchJson(`${endpoint}?offers=1`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setOffers(result.offers || []); setOfferState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setOfferState('failed'); });
    return () => controller.abort();
  }, [endpoint, editor?.type, editor?.type === 'booking' && Boolean(editor.original), offerState]);

  const bookingHref = (id: string, options?: Record<string, string>) => {
    const parameters = new URLSearchParams({ ...options, return: window.location.pathname + window.location.search });
    return `/${practice ? 'praktijk' : 'admin'}/afspraken/${id}?${parameters}`;
  };
  const openItem = (item: Item) => {
    if (item.editable) { openEvent({ startsAt: toBrusselsLocalInput(item.startsAt), endsAt: toBrusselsLocalInput(item.endsAt) }, item); return; }
    if (!practice && item.source === 'mygrowise') { window.location.assign(bookingHref(item.id)); return; }
    open({ type: 'detail', item });
  };
  const chooseSlot = (dates: TimeRange) => open({ type: 'choose', dates });

  const mutate = async (url: string, method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>, message: string, confirm?: string) => {
    if (busy || (confirm && !window.confirm(confirm))) return;
    setBusy(true);
    setEditorError('');
    try {
      const response = await fetchJson(url, { method, ...(method === 'DELETE' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
      const mailMessages: Record<string, string> = {
        sent: ' De mail is geaccepteerd door de mailserver.', suppressed: ' De cliënt heeft e-mailmeldingen uitgeschakeld.',
        pending: ' De mail wacht op verzending.', sending: ' De mail wordt verzonden.',
        failed: ' De mail kon niet worden verzonden.', unknown: ' De verzendstatus is onbekend.',
      };
      setNotice(message + (mailMessages[response.mail] || ''));
      close();
      refresh();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'De wijziging kon niet worden bevestigd.');
    } finally { setBusy(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || busy) return;
    try {
      if (editor.type === 'event' || editor.type === 'block') {
        const startsAt = localInstant(editor.fields.startsAt);
        const endsAt = localInstant(editor.fields.endsAt);
        if (endsAt <= startsAt) throw new Error('Kies een eindtijd na de begintijd.');
        if (editor.type === 'block') {
          void mutate(endpoint, 'POST', { action: 'block', ...editor.fields, startsAt, endsAt }, 'Blokkade toegevoegd.');
        } else {
          const { fields } = editor;
          if ([...fields.title.trim()].length < 2) throw new Error('Vul een titel van minstens twee tekens in.');
          const url = !practice && fields.id ? `${endpoint}?id=${encodeURIComponent(fields.id)}` : endpoint;
          void mutate(url, practice || !fields.id ? 'POST' : 'PATCH', { ...fields, startsAt, endsAt,
            action: fields.id ? 'external_update' : 'external_create' }, fields.id ? 'Moment aangepast.' : 'Moment toegevoegd.');
        }
      }
      if (editor.type === 'booking') {
        const startsAt = localInstant(editor.fields.startsAt);
        if (Date.parse(startsAt) <= Date.now()) throw new Error('Kies een toekomstig tijdstip.');
        const { original } = editor;
        void mutate(endpoint, 'POST', { action: original ? 'reschedule' : 'manual', ...editor.fields, startsAt,
          id: original?.id, revision: original?.revision }, original ? 'Afspraak verplaatst.' : 'Afspraak ingepland.');
      }
    } catch (error) { setEditorError(error instanceof Error ? error.message : 'Controleer je invoer.'); }
  };

  const updatePosition = async (changeEvent: EventChangeArg) => {
    const item = itemFromEvent(changeEvent.event);
    if (!item.revision || moves.includes(item.id)) { changeEvent.revert(); return; }
    setMoves(value => [...value, item.id]);
    try {
      const event = changeEvent.event;
      // Preserve timed edits as instants, and interpret date-only edits as Brussels days.
      const instant = (value: string) => value.length === 10 ? localInstant(`${value}T00:00`) : new Date(value).toISOString();
      await fetchJson(`${endpoint}?id=${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'move', revision: item.revision, startsAt: instant(event.startStr), endsAt: instant(event.endStr) }) });
      setNotice('Tijdstip aangepast.');
    } catch (error) {
      changeEvent.revert();
      setNotice(error instanceof Error ? error.message : 'Verplaatsen is niet gelukt.');
    } finally {
      setMoves(value => value.filter(id => id !== item.id));
      refresh();
    }
  };

  const datesSet = (info: DatesSetArg) => {
    const value = { from: info.startStr, to: info.endStr, date: toBrusselsLocalInput(info.view.calendar.getDate()).slice(0, 10), view: info.view.type };
    setRange(previous => previous && JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
  };
  const syncNow = async () => {
    setSyncBusy(true);
    try {
      const result = await fetchJson(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) });
      setSync(result.sync ?? null);
      const outcomes: Record<string, string> = {
        refreshed: 'MijnDiAd is bijgewerkt.', recent: 'MijnDiAd is kort geleden gecontroleerd.', in_progress: 'MijnDiAd wordt al gecontroleerd.',
        inactive: 'De MijnDiAd-koppeling is inactief.', failed: 'MijnDiAd kon niet worden bijgewerkt. De laatst bekende gegevens blijven zichtbaar.',
      };
      setNotice(outcomes[result.outcome] || 'De status van MijnDiAd is onbekend.');
      refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'MijnDiAd kon niet worden gecontroleerd.'); }
    finally { setSyncBusy(false); }
  };

  const outOfHours = hours.min < '07:00:00' || hours.max > '23:00:00';
  const loadError = loadState?.key === query ? loadState.error : undefined;
  const loading = !loadState || loadState.key !== query;
  const coverageWarning = Boolean(hasItransform && range && Date.parse(range.to) > clock &&
    (!sync?.coverageUntil || Date.parse(range.to) > Date.parse(sync.coverageUntil)));
  const syncWarning = Boolean(!sync?.enabled || !sync.lastSuccessAt || sync.lastError || clock - Date.parse(sync.lastSuccessAt) > 300000 || sync.pendingMissing || sync.coverageUncertain || coverageWarning);
  const syncLabel = !sync ? 'MijnDiAd · status onbekend' : !sync.enabled ? 'MijnDiAd · inactief' : syncWarning ? 'MijnDiAd · controleren' : 'MijnDiAd · bijgewerkt';

  return <div className={`unified-agenda${practice ? ' unified-agenda--practice' : ''}`}>
    <div className="unified-agenda__controls">
      <div className="unified-agenda__filters">
        {hasItransform && <div className="unified-agenda__source" role="group" aria-label="Agenda filter">
          {([['all', 'Alles'], ['mygrowise', 'MyGrowise'], ['itransform', 'Praktijk Itransform']] as const).map(([value, label]) =>
            <button key={value} type="button" className={source === value ? 'is-active' : ''} aria-pressed={source === value} onClick={() => setSource(value)}>{label}</button>)}
        </div>}
        {!practice && <label className="unified-agenda__search"><span>Professional</span><select value={practitioner} onChange={event => setPractitioner(event.target.value)}>
          <option value="all">Iedereen</option>{professionals.map(person => <option key={person.id} value={person.id}>{person.name}{!person.active ? ' (inactief)' : ''}</option>)}
        </select></label>}
        <label className="unified-agenda__search"><span>Zoeken</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} autoComplete="off" placeholder="Naam, locatie of titel…" /></label>
      </div>
      <div className="unified-agenda__actions">
        {hasItransform && <details name="agenda-tools" className={`unified-agenda__menu unified-agenda__sync${syncWarning ? ' is-warning' : ''}`}>
          <summary><i aria-hidden="true" />{syncLabel}</summary><div className="unified-agenda__popover">
            <strong>MijnDiAd-koppeling</strong>
            <p>{sync?.lastSuccessAt ? `Laatst opgehaald op ${dateTime.format(new Date(sync.lastSuccessAt))}` : 'Nog geen geslaagde controle.'}</p>
            {sync?.coverageUntil && <p>Beschikbaarheid gecontroleerd tot {dateTime.format(new Date(sync.coverageUntil))}.</p>}
            {sync?.lastError && <p className="is-warning">{sync.lastError === 'unsupported_recurrence' ? 'Een herhalend moment kon niet veilig worden verwerkt.' : 'De laatste controle is mislukt.'} De vorige gegevens zijn behouden.</p>}
            {!!sync?.pendingMissing && <p className="is-warning">{sync.pendingMissing} verdwenen momenten wachten op bevestiging.</p>}
            {coverageWarning && <p className="is-warning">Een deel van deze periode valt buiten de gecontroleerde periode.</p>}
            <p>{imported.length} zichtbare momenten uit MijnDiAd, waarvan {imported.filter(item => item.kind === 'appointment' && /\bonline\b/i.test(`${item.title} ${item.location}`)).length} online afspraken.</p>
            <p>Pas externe afspraken aan in MijnDiAd. De agenda haalt wijzigingen op nadat MijnDiAd ze publiceert.</p>
            <button type="button" disabled={syncBusy} onClick={syncNow}>{syncBusy ? 'Controleren…' : 'Nu verversen'}</button>
          </div>
        </details>}
        <details name="agenda-tools" className="unified-agenda__menu">
          <summary>Weergave</summary><div className="unified-agenda__popover">
            {practice && range?.view === 'timeGridWeek' && <label className="unified-agenda__private-toggle"><input type="checkbox" checked={showWeekends} onChange={event => setShowWeekends(event.target.checked)} />Weekend tonen</label>}
            <label className="unified-agenda__private-toggle"><input type="checkbox" checked={showPrivate} onChange={event => setShowPrivate(event.target.checked)} />Persoonlijke momenten tonen</label>
            <label className="unified-agenda__private-toggle"><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} />Geannuleerde en geweigerde afspraken tonen</label>
            {practice && <><p>De groene achtergrond toont waar minstens één publiek afspraaktype past.</p><a href="/praktijk/beschikbaarheid">Weekschema beheren</a></>}
          </div>
        </details>
        {practice ? <details name="agenda-tools" className="unified-agenda__menu unified-agenda__create">
          <summary>+ Nieuw</summary><div className="unified-agenda__popover">
            {(['Cliëntafspraak', 'Tijd blokkeren', 'Eigen moment'] as const).map((label, index) => <button key={label} type="button" onClick={event => {
              const menu = event.currentTarget.closest('details');
              menu?.querySelector('summary')?.focus();
              if (menu) menu.open = false;
              const dates = windowFor(nextQuarter());
              if (index === 0) open({ type: 'booking', fields: { startsAt: dates.startsAt, patientId: '', offerId: '' } });
              else if (index === 1) open({ type: 'block', fields: { ...dates, reason: '' } });
              else openEvent(dates);
            }}>{label}</button>)}
          </div>
        </details> : <>
          <button type="button" className="unified-agenda__new" onClick={() => openEvent(windowFor(nextQuarter()))}>+ Nieuw moment</button>
          <a className="unified-agenda__new" href={typeof window === 'undefined' ? '/admin/afspraken/nieuw' : bookingHref('nieuw', practitioner === 'all' ? {} : { professional: practitioner })}>+ Cliëntafspraak</a>
        </>}
      </div>
    </div>
    <div className="agenda-feedback" aria-live="polite">
      {loadError && <div className="unified-agenda__notice is-warning">{payload ? 'De agenda kon niet worden ververst. Je ziet de laatst geladen afspraken.' : loadError}<button type="button" onClick={refresh}>Opnieuw laden</button></div>}
      {loading && !payload && <p>Agenda laden…</p>}
      {!loading && !loadError && payload && !results.length && <p>{search || source !== 'all' ? 'Geen momenten die aan deze filters voldoen.' : 'Geen geplande momenten in deze periode.'}</p>}
      {!loadError && (payload?.availabilityUnknown || coverageWarning) && <p className="is-warning">{payload?.availabilityUnknown ? 'Publieke beschikbaarheid kon niet worden gecontroleerd.' : 'De externe beschikbaarheid is voor een deel van deze periode onbekend.'}</p>}
      {!loadError && outOfHours && range?.view.startsWith('timeGrid') && <p>Er zijn momenten buiten 07:00–23:00. <button type="button" className="agenda-text-button"
        onClick={() => calendarRef.current?.getApi().scrollToTime(hours.min < '07:00:00' ? hours.min : '22:00:00')}>Toon die uren</button></p>}
      {!loadError && results.some(item => item.conflict) && <p className="is-warning">Een afspraak of blokkade overlapt met MijnDiAd. Open het gemarkeerde moment om dit te controleren.</p>}
      {notice && <div className="unified-agenda__notice">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Melding sluiten">×</button></div>}
    </div>
    {practice && range?.view === 'timeGridWeek' && !showWeekends && weekendCount > 0 &&
      <div className="unified-agenda__weekend-notice">{weekendCount} {weekendCount === 1 ? 'moment begint' : 'momenten beginnen'} in het weekend.<button type="button" onClick={() => setShowWeekends(true)}>Toon weekend</button></div>}
    <div className="agenda-calendar" aria-busy={loading}>
      <FullCalendar ref={calendarRef} plugins={plugins} locale={nlLocale} timeZone={zone}
        initialView={initial.view} initialDate={initial.date} firstDay={1} nowIndicator selectable selectMirror
        eventResizableFromStart weekends={showWeekends} views={{ timeGridDay: { weekends: true }, listWeek: { weekends: true }, dayGridMonth: { weekends: true } }}
        datesSet={datesSet} slotEventOverlap={false} eventMinHeight={24} eventShortHeight={38} dayMaxEvents={4}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
        buttonText={{ today: 'Vandaag', month: 'Maand', week: 'Week', day: 'Dag', list: 'Lijst' }}
        allDaySlot slotMinTime={hours.min} slotMaxTime={hours.max} slotDuration="00:30:00" snapDuration="00:15:00"
        height={practice ? 'clamp(520px, calc(100dvh - 180px), 1100px)' : 'auto'} scrollTime="08:30:00" scrollTimeReset={false} expandRows
        dayHeaderFormat={{ weekday: 'short', day: 'numeric', month: 'short' }} slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        events={events} dateClick={arg => chooseSlot(windowFor(arg.dateStr))}
        select={arg => { chooseSlot(windowFor(arg.startStr, arg.endStr, arg.allDay)); calendarRef.current?.getApi().unselect(); }}
        eventClick={arg => { const item = itemFromEvent(arg.event); if (item.source !== 'availability') openItem(item); }}
        eventDrop={updatePosition} eventResize={updatePosition}
        eventContent={arg => {
          const item = itemFromEvent(arg.event);
          return item.source === 'availability' ? null : <AgendaEventCard item={item} timeText={arg.timeText} compact={arg.view.type === 'dayGridMonth'}
            list={arg.view.type === 'listWeek'} onOpen={() => openItem(item)} />;
        }}
      />
    </div>
    {editor && <AgendaDialog key={editor.type} title={editor.type === 'choose' ? 'Wat wil je plannen?' : editor.type === 'detail' ? editor.item.title
      : editor.type === 'block' ? 'Tijd blokkeren' : editor.type === 'booking' ? editor.original ? 'Afspraak verplaatsen' : 'Cliëntafspraak plannen'
      : editor.fields.id ? 'Moment aanpassen' : 'Nieuw moment'} onDismiss={close} busy={busy} dirty={dirty}>
      {editor.type === 'choose' && <div className="practice-agenda-choice">
        <p>{editor.dates.startsAt.replace('T', ' · ')} – {editor.dates.endsAt.replace('T', ' · ')}</p>
        {practice ? <button type="button" onClick={() => open({ type: 'booking', fields: { startsAt: editor.dates.startsAt, patientId: '', offerId: '' } })}>Cliëntafspraak plannen</button>
          : <a href={bookingHref('nieuw', { start: editor.dates.startsAt, ...(practitioner === 'all' ? {} : { professional: practitioner }) })}>Cliëntafspraak plannen</a>}
        <button type="button" onClick={() => openEvent(editor.dates)}>Eigen moment toevoegen</button>
        {practice && <button type="button" onClick={() => open({ type: 'block', fields: { ...editor.dates, reason: '' } })}>Tijd blokkeren</button>}
        {practice && !loadError && !payload?.availabilityUnknown && (() => {
          const choices = [...new Set(bookable.filter(slot => toBrusselsLocalInput(slot.startsAt) === editor.dates.startsAt).map(slot => slot.title))];
          return choices.length ? <p>Publiek boekbaar om dit uur: {choices.join(', ')}</p> : null;
        })()}
      </div>}
      {editor.type === 'detail' && (() => {
        const { item } = editor;
        const booking = item.source === 'mygrowise';
        const statusAction = (status: string, message: string, confirmation?: string) =>
          mutate(endpoint, 'POST', { action: 'status', id: item.id, revision: item.revision, status }, message, confirmation);
        return <>
          <div className="practice-agenda-detail">
            <strong>{rangeTitle(item)}</strong>
            <span>{item.source === 'block' ? 'Niet beschikbaar' : booking ? statusLabels[item.status] : 'Praktijk Itransform'}</span>
            {item.subtitle && <span>{item.subtitle}</span>}
            {item.location && !item.externalSource && <span>{item.location}</span>}
            {item.conflict && <p role="alert">Dit moment overlapt met een ander bezet tijdvak.</p>}
            {booking && <a href={bookingHref(item.id)}>Afspraakdetails en mails</a>}
            {item.patientId && <a href={`/praktijk/clienten/${item.patientId}`}>Open cliëntendossier</a>}
            {editorError && <p role="alert">{editorError}</p>}
          </div>
          {item.externalSource && <ImportedAgendaDetails item={item} />}
          {practice && <footer className="practice-agenda-actions">
            {item.source === 'block' && <button type="button" disabled={busy} onClick={() => mutate(endpoint, 'POST', { action: 'unblock', id: item.id }, 'Blokkade verwijderd.', `Blokkade opheffen voor ${rangeTitle(item)}?`)}>Blokkade verwijderen</button>}
            {booking && item.status === 'pending' && <>
              <button type="button" disabled={busy} onClick={() => statusAction('declined', 'Aanvraag geweigerd.', `Aanvraag van ${item.title} weigeren?`)}>Weigeren</button>
              {Date.parse(item.startsAt) > clock && <button type="button" disabled={busy} onClick={() => statusAction('confirmed', 'Aanvraag bevestigd.')}>Aanvaarden</button>}
            </>}
            {booking && item.status === 'confirmed' && <>
              <button type="button" disabled={busy} onClick={() => statusAction('cancelled', 'Afspraak geannuleerd.', `Afspraak van ${item.title} op ${rangeTitle(item)} annuleren? De cliënt krijgt een melding volgens diens voorkeuren.`)}>Afspraak annuleren</button>
              {Date.parse(item.startsAt) <= clock && <button type="button" disabled={busy} onClick={() => statusAction('no_show', 'Afspraak gemarkeerd als niet verschenen.', `${item.title} markeren als niet verschenen?`)}>Niet verschenen</button>}
              {Date.parse(item.startsAt) > clock && <button type="button" disabled={busy} onClick={() => open({ type: 'booking', original: item, fields: { startsAt: toBrusselsLocalInput(item.startsAt), patientId: '', offerId: '' } })}>Verplaatsen</button>}
              {Date.parse(item.endsAt) <= clock && <button type="button" disabled={busy} onClick={() => statusAction('completed', 'Afspraak afgerond.', `Afspraak van ${item.title} afronden?`)}>Afronden</button>}
            </>}
            {busy && <span role="status">Bezig…</span>}
          </footer>}
        </>;
      })()}
      {(editor.type === 'event' || editor.type === 'block' || editor.type === 'booking') && <form onSubmit={submit}>
        <fieldset className="unified-agenda__fields agenda-editor-fields" disabled={busy}>
          {editor.type === 'event' && (() => {
            const fields = editor.fields;
            const patch = (values: Partial<EventFields>) => change({ ...editor, fields: { ...fields, ...values } });
            return <>
              {hasItransform && <label><span>Agenda</span><select value={fields.calendarScope} onChange={event => patch({ calendarScope: event.target.value as EventFields['calendarScope'] })}><option value="mygrowise">MyGrowise</option><option value="itransform">Praktijk Itransform</option></select></label>}
              <label><span>Titel</span><input required minLength={2} maxLength={100} autoComplete="off" value={fields.title} onChange={event => patch({ title: event.target.value })} /></label>
              <label><span>Type</span><select value={fields.kind} onChange={event => patch({ kind: event.target.value as EventFields['kind'] })}><option value="appointment">Afspraak</option><option value="block">Niet beschikbaar</option><option value="personal">Persoonlijk</option></select></label>
              {!practice && <label><span>Professional</span><select required value={fields.practitionerId} onChange={event => patch({ practitionerId: event.target.value })}>
                <option value="">Kies een professional</option>{professionals.filter(person => person.active || person.id === fields.practitionerId).map(person => <option key={person.id} value={person.id}>{person.name}{!person.active ? ' (inactief)' : ''}</option>)}
              </select></label>}
              <label><span>Van</span><input required type="datetime-local" value={fields.startsAt} onChange={event => patch({ startsAt: event.target.value })} /></label>
              <label><span>Tot</span><input required type="datetime-local" value={fields.endsAt} onChange={event => patch({ endsAt: event.target.value })} /></label>
              <label className="is-wide"><span>Locatie</span><input maxLength={120} value={fields.location} onChange={event => patch({ location: event.target.value })} /></label>
              <fieldset className="is-wide"><legend>Kleur</legend><div className="unified-agenda__colours">
                {colours.map(([name, color]) => <button key={color} type="button" aria-label={name} aria-pressed={fields.color === color} className={fields.color === color ? 'is-selected' : ''} style={{ background: color }} onClick={() => patch({ color })} />)}
                <label className="unified-agenda__custom-colour">Eigen kleur<input type="color" value={fields.color} onChange={event => patch({ color: event.target.value })} /></label>
              </div></fieldset>
            </>;
          })()}
          {editor.type === 'block' && <label className="is-wide"><span>Privénotitie (optioneel)</span><input maxLength={80} value={editor.fields.reason} onChange={event => change({ ...editor, fields: { ...editor.fields, reason: event.target.value } })} /></label>}
          {editor.type === 'booking' && !editor.original && <>
            <AgendaClientPicker mode="practice" value={editor.fields.patientId} onChange={patientId => change({ ...editor, fields: { ...editor.fields, patientId } })} />
            <label className="is-wide"><span>Afspraaktype</span><select required value={editor.fields.offerId} onChange={event => change({ ...editor, fields: { ...editor.fields, offerId: event.target.value } })}>
              <option value="">{offerState === 'idle' ? 'Afspraaktypes laden…' : 'Kies een afspraaktype'}</option>
              {offers.map(offer => <option key={offer.id} value={offer.id}>{offer.name} · {offer.duration} min</option>)}
            </select></label>
            {offerState === 'failed' && <button type="button" onClick={() => setOfferState('idle')}>Afspraaktypes opnieuw laden</button>}
            {offerState === 'ready' && !offers.length && <p>Er zijn geen actieve afspraaktypes.</p>}
          </>}
          {editor.type !== 'event' && <label><span>Van</span><input required type="datetime-local" value={editor.fields.startsAt}
            onChange={event => change({ ...editor, fields: { ...editor.fields, startsAt: event.target.value } } as Editor)} /></label>}
          {editor.type === 'block' && <label><span>Tot</span><input required type="datetime-local" value={editor.fields.endsAt}
            onChange={event => change({ ...editor, fields: { ...editor.fields, endsAt: event.target.value } })} /></label>}
          {editor.type === 'booking' && (() => {
            const offer = offers.find(item => item.id === editor.fields.offerId);
            const duration = editor.original ? (Date.parse(editor.original.endsAt) - Date.parse(editor.original.startsAt)) / 60000 : offer?.duration;
            if (!duration) return null;
            try {
              return <p className="agenda-editor-hint">Tot {dateTime.format(new Date(plusMinutes(localInstant(editor.fields.startsAt), duration)))} · {duration} min{offer?.location ? ` · ${offer.location}` : ''}</p>;
            } catch { return null; }
          })()}
          {editorError && <p className="practice-agenda-form-error" role="alert">{editorError}</p>}
        </fieldset>
        <footer>
          {editor.type === 'event' && editor.fields.id && <button type="button" className="unified-agenda__delete" disabled={busy} onClick={() => {
            const { id, revision, title } = editor.fields;
            const parameters = new URLSearchParams({ id: id || '', revision: revision || '' });
            void mutate(practice ? endpoint : `${endpoint}?${parameters}`, practice ? 'POST' : 'DELETE', { action: 'external_delete', id, revision }, 'Moment verwijderd.', `Moment “${title}” verwijderen?`);
          }}>Verwijderen</button>}
          <span />
          <button className="unified-agenda__save" type="submit" disabled={busy}>{busy ? 'Bezig…' : editor.type === 'block' ? 'Blokkeren' : editor.type === 'booking' ? editor.original ? 'Verplaatsen' : 'Inplannen' : 'Opslaan'}</button>
        </footer>
      </form>}
    </AgendaDialog>}
  </div>;
}
