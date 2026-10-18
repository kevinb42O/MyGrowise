import { useCallback, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import luxon3Plugin from '@fullcalendar/luxon3';
import nlLocale from '@fullcalendar/core/locales/nl';
import type { DateSelectArg, EventApi, EventChangeArg, EventClickArg, EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import { fromBrusselsLocalInput, toBrusselsLocalInput } from '../../lib/brusselsTime';

type Source = 'mygrowise' | 'itransform' | 'block' | 'availability';
type Item = { id: string; source: Source; title: string; subtitle: string; startsAt: string; endsAt: string; status: string; kind: 'appointment' | 'personal' | 'block' | 'availability'; location: string; color: string; editable: boolean; patientId?: string | null; practitionerId?: string | null; externalSource?: 'mijndiad' | null; externalUrl?: string | null };
type FormValue = { id?: string; title: string; startsAt: string; endsAt: string; kind: Item['kind']; location: string; color: string; practitionerId: string | null; calendarScope: 'mygrowise' | 'itransform' };
type BlockValue = { startsAt: string; endsAt: string; reason: string };
type ManualValue = { id?: string; patientId: string; offerId: string; durationMinutes:number; startsAt: string; endsAt: string };
type ClientChoice = { id: string; name: string; email: string };
type CalendarSync = {enabled:boolean;lastAttemptAt:string|null;lastSuccessAt:string|null;lastError:string|null;failureCount:number;eventCount:number;pendingMissing:number;coverageUncertain:number;intervalMinutes:number};

const colours = ['#d26479', '#d97706', '#7c3aed', '#2563eb', '#0891b2', '#15803d', '#374151', '#be123c'];
const toLocalInput = toBrusselsLocalInput;
const toUtcIso = (value: string) => {
  try { return fromBrusselsLocalInput(value); }
  catch (error) { throw new Error(error instanceof Error && error.message === 'ambiguous_time' ? 'Dit uur valt tijdens de omschakeling van zomer- of wintertijd. Kies een ander uur.' : 'Controleer het tijdstip.'); }
};
const calendarToUtcIso = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? new Date(value).toISOString() : toUtcIso(value.slice(0, 16));
const oneHourLater = (value: Date | string) => {
  const local = toLocalInput(value);
  const [, year, month, day, hour, minute] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local) || [];
  if (!year) return new Date(Date.now() + 3600000);
  const wall = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) + 3600000);
  return `${wall.toISOString().slice(0, 16)}`;
};
const fromEvent = (event: EventApi): Item | null => event.extendedProps.item || null;

export function AgendaEventCard({ item, timeText, compact = false, list = false }: { item: Item; timeText: string; compact?: boolean; list?: boolean }) {
  const imported = item.externalSource === 'mijndiad';
  const duration = (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000;
  const short = !compact && !list && duration > 0 && duration <= 30;
  const tiny = short && duration < 30;
  const title = (item.location || '').toLowerCase() === 'online' ? item.title.replace(/\s+online$/i, '') : item.title;
  return <div className={`unified-agenda__event${imported ? ' is-imported' : ''}${compact ? ' is-compact' : ''}${short ? ' is-short' : ''}${tiny ? ' is-tiny' : ''}`} title={[timeText, item.title, item.location, imported ? 'MijnDiAd' : ''].filter(Boolean).join(' · ')}>
    <b>{timeText}</b>
    <span>{item.status === 'pending' ? 'Aanvraag · ' : !imported && item.source === 'itransform' ? 'Itransform · ' : ''}{title}</span>
    {imported && !compact && !short && item.location && <small>{item.location.split(' - ')[0]}</small>}
  </div>;
}

export function ImportedAgendaDetails({ item }: { item: Item }) {
  return <div className="practice-agenda-import-details">
    <dl><div><dt>Duur</dt><dd>{Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 60000)} minuten</dd></div>
      <div><dt>Locatie</dt><dd>{item.location || 'Niet opgegeven'}</dd></div>
      {item.kind === 'appointment' && <div><dt>Cliëntnaam</dt><dd>Niet meegeleverd door MijnDiAd</dd></div>}
      <div><dt>Bron</dt><dd>MijnDiAd</dd></div></dl>
    {item.externalUrl && /^https:\/\/praktijkitransform\.mijndiad\.nl\/appointments\/\d+$/.test(item.externalUrl) && <a className="practice-agenda-import-details__link" href={item.externalUrl} target="_blank" rel="noopener noreferrer">Open oorspronkelijke afspraak in MijnDiAd ↗</a>}
    <p>De cliëntnaam wordt niet gedeeld via deze agendalink. Om de naam en verdere gegevens in MijnDiAd te bekijken moet je daar ingelogd zijn. Wijzigingen verschijnen na de volgende geslaagde verversing van de koppeling.</p>
  </div>;
}

export default function UnifiedAgenda({ mode = 'admin', allowItransform = false }: { mode?: 'admin' | 'practice'; allowItransform?: boolean }) {
  const calendarRef = useRef<FullCalendar>(null);
  const loadVersion = useRef(0);
  const [source, setSource] = useState<'all' | Source>('all');
  const [hasItransformAccess, setCanUseItransform] = useState(allowItransform);
  const canUseItransform = mode === 'practice' && hasItransformAccess;
  const [practitionerFilter, setPractitionerFilter] = useState('all');
  const [practitioners, setPractitioners] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormValue | null>(null);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<Item | null>(null);
  const [block, setBlock] = useState<BlockValue | null>(null);
  const [manual, setManual] = useState<ManualValue | null>(null);
  const [slotChoice, setSlotChoice] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [offers,setOffers]=useState<{id:string;name:string;duration:number}[]>([]);
  const [clients, setClients] = useState<ClientChoice[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showWeekends, setShowWeekends] = useState(mode !== 'practice');
  const [weekendCount, setWeekendCount] = useState(0);
  const [calendarView, setCalendarView] = useState('timeGridWeek');
  const [sync,setSync] = useState<CalendarSync|null>(null);
  const [syncLoaded,setSyncLoaded] = useState(false);
  const [syncBusy,setSyncBusy] = useState(false);
  const [clock,setClock] = useState(Date.now());
  const [importSummary, setImportSummary] = useState({ total: 0, online: 0, private: 0 });

  const refresh = useCallback(() => calendarRef.current?.getApi().refetchEvents(), []);
  useEffect(() => {
    if (mode !== 'practice') return;
    const update = () => {setClock(Date.now());if(document.visibilityState==='visible')refresh();};
    const timer = window.setInterval(update,300_000);
    window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return () => {window.clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[mode,refresh]);
  const mapEvent = useCallback((item: Item): EventInput => ({
    id: `${item.source}:${item.id}`, title: item.title, start: item.startsAt, end: item.endsAt, editable: item.editable && mode === 'admin',
    display: item.source === 'availability' ? 'background' : 'auto',
    classNames: [`unified-agenda__item--${item.source}`, `unified-agenda__item--${item.status}`, ...(item.externalSource ? ['unified-agenda__item--imported'] : [])],
    backgroundColor: mode === 'practice' && item.externalSource ? `${item.color}14` : item.color,
    borderColor: item.color, textColor: mode === 'practice' && item.externalSource ? '#233f4c' : '#ffffff',
    extendedProps: { item },
  }), [mode]);
  const loadEvents = useCallback(async (info: EventSourceFuncArg, success: (events: EventInput[]) => void, failure: (error: Error) => void) => {
    const version = ++loadVersion.current;
    try {
      const endpoint = mode === 'practice' ? '/api/praktijk/agenda' : '/api/admin/agenda';
      const response = await fetch(`${endpoint}?from=${encodeURIComponent(info.startStr)}&to=${encodeURIComponent(info.endStr)}`);
      const payload = await response.json();
      if (version !== loadVersion.current) return;
      if (!response.ok) throw new Error(payload.error || 'Agenda kon niet laden.');
      if (mode === 'admin') setPractitioners(payload.practitioners || []);
      else {setCanUseItransform(payload.canUseItransform === true);setSync(payload.sync || null);setSyncLoaded(true);setClock(Date.now());}
      const needle = search.trim().toLowerCase();
      const filtered = (payload.events as Item[]).filter((item) => (mode !== 'admin' || item.source === 'mygrowise') && (source === 'all' || item.source === source || (mode === 'practice' && source === 'mygrowise' && (item.source === 'block' || item.source === 'availability'))) && (mode === 'practice' || practitionerFilter === 'all' || item.practitionerId === practitionerFilter) && (showPrivate || item.externalSource !== 'mijndiad' || item.kind === 'appointment') && (item.source === 'availability' || !needle || `${item.title} ${item.subtitle} ${item.location}`.toLowerCase().includes(needle)));
      const imported = filtered.filter(item => item.externalSource === 'mijndiad');
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Brussels' });
      setWeekendCount(filtered.filter(item => item.source !== 'availability' && ['Sat', 'Sun'].includes(weekday.format(new Date(item.startsAt)))).length);
      setImportSummary({ total: imported.length, online: imported.filter(item => item.kind==='appointment' && /\bonline\b/i.test(`${item.title} ${item.location}`)).length, private: imported.filter(item => item.kind !== 'appointment').length });
      success(filtered.map(mapEvent));
    } catch (error) {
      if (version !== loadVersion.current) return;
      const failureError = error instanceof Error ? error : new Error('Agenda kon niet laden.');
      setNotice(failureError.message);
      setImportSummary({ total: 0, online: 0, private: 0 });
      setWeekendCount(0);
      failure(failureError);
    }
  }, [mapEvent, mode, practitionerFilter, search, source, showPrivate]);
  const openNew = (start: Date | string, end?: Date | string) => {
    const calendarScope = canUseItransform && source === 'itransform' ? 'itransform' : 'mygrowise';
    setNotice('');
    setForm({ title: '', startsAt: toLocalInput(start), endsAt: toLocalInput(end || oneHourLater(start)),
      kind: mode === 'practice' ? 'personal' : 'appointment', location: '',
      color: calendarScope === 'mygrowise' ? '#1f7060' : '#d26479',
      practitionerId: mode === 'practice' || practitionerFilter === 'all' ? null : practitionerFilter, calendarScope });
  };
  const openEdit = (item: Item) => { setNotice(''); setForm({ id: item.id, title: item.title, startsAt: toLocalInput(item.startsAt), endsAt: toLocalInput(item.endsAt), kind: item.kind, location: item.location, color: item.color, practitionerId: item.practitionerId || null, calendarScope: item.source === 'itransform' ? 'itransform' : 'mygrowise' }); };
  const save = async () => {
    if (!form || busy) return;
    let startsAt: string; let endsAt: string;
    try { startsAt = toUtcIso(form.startsAt); endsAt = toUtcIso(form.endsAt); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Controleer het tijdstip.'); return; }
    if (new Date(endsAt) <= new Date(startsAt)) { setNotice('Het einduur moet na het beginuur vallen.'); return; }
    if (mode === 'admin' && form.calendarScope === 'mygrowise' && !form.practitionerId) { setNotice('Kies een professional voor dit MyGrowise-moment.'); return; }
    setBusy(true);
    try {
      const response = await fetch(mode === 'practice' ? '/api/praktijk/agenda' : form.id ? `/api/admin/agenda?id=${encodeURIComponent(form.id)}` : '/api/admin/agenda', { method: mode === 'practice' ? 'POST' : form.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, startsAt, endsAt, ...(mode === 'practice' ? { action: form.id ? 'external_update' : 'external_create' } : {}) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Opslaan is niet gelukt.');
      setForm(null); setNotice(form.id ? 'Moment aangepast.' : 'Moment toegevoegd.'); refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Opslaan is niet gelukt.'); }
    finally { setBusy(false); }
  };
  const updatePosition = async (change: EventChangeArg) => {
    const item = fromEvent(change.event);
    if (!item?.editable) { change.revert(); return; }
    let startsAt: string; let endsAt: string;
    try { startsAt = calendarToUtcIso(change.event.startStr); endsAt = calendarToUtcIso(change.event.endStr); }
    catch (error) { change.revert(); setNotice(error instanceof Error ? error.message : 'Ongeldig tijdstip.'); return; }
    try {
      const response = await fetch(`/api/admin/agenda?id=${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: item.title, kind: item.kind, location: item.location, color: item.color, practitionerId: item.practitionerId || null, calendarScope: item.source, startsAt, endsAt }) });
      if (!response.ok) throw new Error('Verplaatsen is niet gelukt.');
      setNotice('Tijdstip aangepast.'); refresh();
    } catch (error) { change.revert(); setNotice(error instanceof Error ? error.message : 'Verplaatsen is niet gelukt.'); }
  };
  const onEventClick = (click: EventClickArg) => {
    const item = fromEvent(click.event);
    if (!item) return;
    if(mode==='admin'&&item.source==='mygrowise'&&!item.editable){window.location.href=`/admin/afspraken/${item.id}`;return;}
    if (mode === 'practice') { setNotice(''); item.editable ? openEdit(item) : setDetail(item); return; }
    if (item.editable) openEdit(item);
    else window.location.assign('/admin/boekingen');
  };
  const remove = async () => {
    if (!form?.id || busy || !window.confirm(`Verwijder “${form.title}”?`)) return;
    setBusy(true);
    try {
      const response = await fetch(mode === 'practice' ? '/api/praktijk/agenda' : `/api/admin/agenda?id=${encodeURIComponent(form.id)}`, { method: mode === 'practice' ? 'POST' : 'DELETE', headers: mode === 'practice' ? { 'content-type': 'application/json' } : undefined, body: mode === 'practice' ? JSON.stringify({ action: 'external_delete', id: form.id }) : undefined });
      if (!response.ok) throw new Error('Verwijderen is niet gelukt.');
      setForm(null); setNotice('Moment verwijderd.'); refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Verwijderen is niet gelukt.'); }
    finally { setBusy(false); }
  };
  const chooseSource = (next: 'all' | Source) => { setSource(next); setTimeout(refresh, 0); };
  const openBlock = (start: Date | string, end?: Date | string) => { setNotice(''); setSlotChoice(null); setBlock({ startsAt: toLocalInput(start), endsAt: toLocalInput(end || oneHourLater(start)), reason: '' }); };
  const openManual = (start: Date | string, end?: Date | string, id?: string) => {
    setNotice('');
    setSlotChoice(null);
    setDetail(null);
    setManual({ id, patientId: '', offerId:'', durationMinutes:id&&end?Math.max(15,(new Date(end).getTime()-new Date(start).getTime())/60000):60, startsAt: toLocalInput(start), endsAt: toLocalInput(end || oneHourLater(start)) });
    if (id || clients.length) return;
    setClientsLoading(true);
    fetch('/api/praktijk/agenda?clients=1').then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Cliënten konden niet worden geladen.');
      setClients(payload.clients || []);
      setOffers(payload.offers || []);
    }).catch((error) => setNotice(error instanceof Error ? error.message : 'Cliënten konden niet worden geladen.'))
      .finally(() => setClientsLoading(false));
  };
  const practiceAction = async (action: string, extra: Record<string, string>) => {
    setBusy(true);
    try {
      const response = await fetch('/api/praktijk/agenda', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Opslaan is niet gelukt.');
      setDetail(null); setBlock(null); setManual(null);
      setNotice(action === 'status' ? extra.status === 'confirmed' ? 'Aanvraag bevestigd.' : extra.status === 'declined' ? 'Aanvraag geweigerd.' : 'Afspraak bijgewerkt.' : action === 'block' ? 'Blokkade toegevoegd.' : action === 'unblock' ? 'Blokkade verwijderd.' : action === 'manual' ? 'Afspraak ingepland.' : action === 'reschedule' ? 'Afspraak verplaatst.' : 'Agenda bijgewerkt.');
      refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Opslaan is niet gelukt.'); }
    finally { setBusy(false); }
  };
  const updatePracticeStatus = (status: string) => detail && practiceAction('status', { id: detail.id, status });
  const saveBlock = () => {
    if (!block) return;
    try {
      const startsAt = toUtcIso(block.startsAt); const endsAt = toUtcIso(block.endsAt);
      if (endsAt <= startsAt) throw new Error('Controleer begin- en eindtijd.');
      practiceAction('block', { startsAt, endsAt, reason: block.reason });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Controleer het tijdstip.'); }
  };
  const saveManual = () => {
    if (!manual) return;
    try {
      const startsAt = toUtcIso(manual.startsAt);
      const duration=manual.id?manual.durationMinutes:offers.find(offer=>offer.id===manual.offerId)?.duration||60;
      const endsAt=new Date(Date.parse(startsAt)+duration*60000).toISOString();
      if (endsAt <= startsAt || (!manual.id && (!manual.patientId||!manual.offerId))) throw new Error('Kies een cliënt en controleer begin- en eindtijd.');
      practiceAction(manual.id ? 'reschedule' : 'manual', { id: manual.id || '', patientId: manual.patientId, offerId:manual.offerId, startsAt, endsAt });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Controleer het tijdstip.'); }
  };
  const chooseSlot = (start: Date | string, end?: Date | string) => {
    setNotice('');
    setSlotChoice({ startsAt: toLocalInput(start), endsAt: toLocalInput(end || oneHourLater(start)) });
  };
  const nextQuarter = () => new Date(Math.ceil((Date.now() + 300000) / 900000) * 900000);
  const syncWarning = !sync?.enabled || !sync.lastSuccessAt || !!sync.lastError || clock-Date.parse(sync.lastSuccessAt)>15*60000 || sync.pendingMissing>0 || sync.coverageUncertain>0;
  const syncTime = sync?.lastSuccessAt ? new Intl.DateTimeFormat('nl-BE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Brussels'}).format(new Date(sync.lastSuccessAt)) : null;
  const syncLabel = !syncLoaded?'MijnDiAd laden…':!sync?'MijnDiAd · status onbekend':!sync.enabled?'MijnDiAd · niet actief':`MijnDiAd · ${syncTime ? syncWarning?'controleren':syncTime : 'niet bijgewerkt'}`;
  const syncNow = async () => {
    if(syncBusy)return;setSyncBusy(true);
    try {const response=await fetch('/api/praktijk/agenda',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'sync'})});const payload=await response.json();if(!response.ok)throw new Error(payload.error);refresh();}
    catch(error){setNotice(error instanceof Error?error.message:'Verversen is niet gelukt.');refresh();}
    finally{setSyncBusy(false);}
  };
  const closeMenu = (event:React.MouseEvent<HTMLElement>) => event.currentTarget.closest('details')?.removeAttribute('open');

  return <div className={`unified-agenda${mode === 'practice' ? ' unified-agenda--practice' : ''}`}>
    <div className="unified-agenda__controls">
      <div className="unified-agenda__filters">
      {canUseItransform && <div className="unified-agenda__source" role="group" aria-label="Agenda filter">
        {([['all', 'Alles'], ['mygrowise', 'MyGrowise'], ['itransform', 'Praktijk Itransform']] as const).map(([value, label]) => <button key={value} type="button" className={source === value ? 'is-active' : ''} onClick={() => chooseSource(value)}><i className={`source-dot source-dot--${value}`} />{label}</button>)}
      </div>}
      {mode === 'admin' && <label className="unified-agenda__search"><span>Professional</span><select value={practitionerFilter} onChange={(event) => { setPractitionerFilter(event.target.value); setTimeout(refresh, 0); }}><option value="all">Iedereen</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
      <label className="unified-agenda__search"><span className={mode==='practice'?'sr-only':undefined}>Zoeken</span><input value={search} onChange={(event) => { setSearch(event.target.value); setTimeout(refresh, 150); }} placeholder="Naam, locatie of titel" /></label>
      </div>
      <div className="unified-agenda__actions">
      {mode==='admin'&&<button type="button" className="unified-agenda__new" onClick={() => openNew(new Date())}>+ Nieuw moment</button>}
      {mode==='admin'&&<a className="unified-agenda__new" href="/admin/afspraken/nieuw">+ Cliëntafspraak</a>}
      {mode==='practice'&&<>
      {canUseItransform&&<details name="practice-agenda-tools" className={`unified-agenda__menu unified-agenda__sync${syncWarning?' is-warning':''}`}><summary><i />{syncBusy?'MijnDiAd verversen…':syncLabel}<span aria-hidden="true">⌄</span></summary><div className="unified-agenda__popover">
        <strong>MijnDiAd-koppeling</strong>
        <p>{sync?.enabled?'Automatisch bijgewerkt bij gebruik van de agenda of boekingspagina. Zolang deze agenda zichtbaar is, controleert ze elke 5 minuten opnieuw. Vóór boeken controleren we strenger.':'De koppeling is nog niet actief.'}</p>
        <p>{sync?.lastSuccessAt?`Laatste geslaagde controle: ${new Intl.DateTimeFormat('nl-BE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Brussels'}).format(new Date(sync.lastSuccessAt))}`:'Nog geen geslaagde automatische controle.'}</p>
        {sync?.lastError&&<p className="is-warning">Ophalen is mislukt. De vorige gegevens zijn behouden.</p>}
        {!!sync?.pendingMissing&&<p className="is-warning">{sync.pendingMissing} verdwenen momenten wachten op bevestiging in de volgende controle.</p>}
        {!!sync?.coverageUncertain&&<p className="is-warning">De gedeelde periode is korter geworden. Controleer de ontbrekende momenten in MijnDiAd.</p>}
        <p>{importSummary.total} momenten in deze periode; {importSummary.online} online consulten en {importSummary.private} privé/overige momenten. Cliëntnamen ontbreken in de feed.</p>
        <p>Wijzigingen kunnen pas worden opgehaald nadat MijnDiAd ze publiceert. De koppeling schrijft niet terug naar MijnDiAd.</p>
        <button type="button" disabled={syncBusy} onClick={syncNow}>{syncBusy?'Bezig…':'Nu verversen'}</button>
      </div></details>}
      <details name="practice-agenda-tools" className="unified-agenda__menu"><summary>Weergave <span aria-hidden="true">⌄</span></summary><div className="unified-agenda__popover">
        {calendarView === 'timeGridWeek' && <label className="unified-agenda__private-toggle"><input type="checkbox" checked={showWeekends} onChange={event => setShowWeekends(event.target.checked)} />Weekend tonen{weekendCount > 0 && <span className="unified-agenda__count">{weekendCount}</span>}</label>}
        {canUseItransform && <label className="unified-agenda__private-toggle"><input type="checkbox" checked={showPrivate} onChange={event => setShowPrivate(event.target.checked)} />Privé / overige tonen</label>}
        <a href="/praktijk/beschikbaarheid">Weekschema beheren →</a>
        <div className="unified-agenda__mini-legend"><span><i style={{background:'#1f7060'}}/>MyGrowise</span><span><i style={{background:'#b6506e'}}/>Itransform · praktijk</span><span><i style={{background:'#326b9e'}}/>Itransform · online</span><span><i style={{background:'#687985'}}/>Privé / niet beschikbaar</span><span><i style={{background:'#e7f4eb'}}/>Boekbaar</span></div>
      </div></details>
      <details name="practice-agenda-tools" className="unified-agenda__menu unified-agenda__create"><summary>+ Nieuw <span aria-hidden="true">⌄</span></summary><div className="unified-agenda__popover">
        <button type="button" onClick={event=>{closeMenu(event);openManual(nextQuarter());}}>Cliëntafspraak</button>
        <button type="button" onClick={event=>{closeMenu(event);openBlock(nextQuarter());}}>Tijd blokkeren</button>
        <button type="button" onClick={event=>{closeMenu(event);openNew(nextQuarter());}}>Eigen moment</button>
      </div></details>
      </>}
      </div>
    </div>
    {mode === 'practice' && calendarView === 'timeGridWeek' && !showWeekends && weekendCount > 0 && <div className="unified-agenda__weekend-notice">{weekendCount} {weekendCount === 1 ? 'moment valt' : 'momenten vallen'} in het weekend.<button type="button" onClick={() => setShowWeekends(true)}>Toon weekend</button></div>}
    {notice && <div className="unified-agenda__notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Melding sluiten">×</button></div>}
    <FullCalendar
      ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxon3Plugin]} locale={nlLocale} timeZone="Europe/Brussels"
      initialView={typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches ? 'timeGridDay' : 'timeGridWeek'} firstDay={1} nowIndicator selectable selectMirror editable eventResizableFromStart eventDurationEditable
      weekends={showWeekends} views={{ timeGridDay: { weekends: true }, listWeek: { weekends: true }, dayGridMonth: { weekends: true } }}
      datesSet={info => setCalendarView(info.view.type)}
      slotEventOverlap={false} eventMinHeight={20} eventShortHeight={38}
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
      buttonText={{ today: 'Vandaag', month: 'Maand', week: 'Week', day: 'Dag', list: 'Lijst' }}
      allDaySlot={false} slotMinTime="07:00:00" slotMaxTime="23:00:00" slotDuration="00:30:00" snapDuration="00:15:00" height={mode === 'practice' ? 'clamp(520px, calc(100dvh - 180px), 1100px)' : 'auto'} scrollTime="08:30:00" expandRows
      dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'short' }} slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      events={loadEvents} dateClick={(arg) => mode === 'practice' ? chooseSlot(arg.dateStr) : openNew(arg.dateStr)} select={(arg: DateSelectArg) => { mode === 'practice' ? chooseSlot(arg.startStr, arg.endStr) : openNew(arg.startStr, arg.endStr); calendarRef.current?.getApi().unselect(); }}
      eventClick={onEventClick} eventDrop={updatePosition} eventResize={updatePosition}
      eventContent={(arg) => arg.event.extendedProps.item?.source === 'availability' ? null : <AgendaEventCard item={arg.event.extendedProps.item} timeText={arg.timeText} compact={arg.view.type === 'dayGridMonth'} list={arg.view.type === 'listWeek'} />}
    />
    {slotChoice && mode === 'practice' && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setSlotChoice(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="practice-agenda-choice" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>Gekozen tijdvak</p><h2 id="practice-agenda-choice">Wat wil je plannen?</h2></div><button type="button" onClick={() => setSlotChoice(null)} aria-label="Sluiten">×</button></header>
      <div className="practice-agenda-choice"><button type="button" onClick={() => openManual(slotChoice.startsAt, slotChoice.endsAt)}><strong>MyGrowise-cliëntafspraak</strong><span>Koppel aan een toegewezen cliënt.</span></button><button type="button" onClick={() => { setSlotChoice(null); openNew(slotChoice.startsAt, slotChoice.endsAt); }}><strong>Eigen moment of privétijd</strong><span>Kies een titel, type en {canUseItransform ? 'organisatie' : 'kleur'}.</span></button><button type="button" onClick={() => openBlock(slotChoice.startsAt, slotChoice.endsAt)}><strong>MyGrowise-tijd blokkeren</strong><span>Maak dit moment niet meer publiek boekbaar.</span></button></div>
    </section></div>}
    {detail && mode === 'practice' && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setDetail(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="practice-agenda-detail" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>{detail.source === 'mygrowise' ? detail.status === 'pending' ? 'Nieuwe aanvraag' : 'Bevestigde afspraak' : detail.source === 'itransform' ? 'Praktijk Itransform' : 'Niet beschikbaar'}</p><h2 id="practice-agenda-detail">{detail.title}</h2></div><button type="button" onClick={() => setDetail(null)} aria-label="Sluiten">×</button></header>
      <div className="practice-agenda-detail"><strong>{new Intl.DateTimeFormat('nl-BE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(new Date(detail.startsAt))} – {new Intl.DateTimeFormat('nl-BE', { timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(new Date(detail.endsAt))}</strong><span>{detail.subtitle}</span>{detail.source==='mygrowise'&&<a href={`/praktijk/afspraken/${detail.id}`}>Afspraakdetails en mails →</a>}{detail.patientId && <a href={`/admin/clienten/${detail.patientId}`}>Open cliëntendossier →</a>}{notice && <p role="alert">{notice}</p>}</div>
      {detail.externalSource === 'mijndiad' && <ImportedAgendaDetails item={detail} />}
      <footer className="practice-agenda-actions">
        {detail.source === 'block' && <button type="button" disabled={busy} onClick={() => practiceAction('unblock', { id: detail.id })}>Blokkade verwijderen</button>}
        {detail.source === 'mygrowise' && detail.status === 'pending' && <>
          <button type="button" disabled={busy} onClick={() => updatePracticeStatus('declined')}>Weigeren</button>
          {Date.parse(detail.startsAt) > Date.now() && <button className="unified-agenda__save" type="button" disabled={busy} onClick={() => updatePracticeStatus('confirmed')}>Aanvaarden</button>}
        </>}
        {detail.source === 'mygrowise' && detail.status === 'confirmed' && <>
          <button type="button" disabled={busy} onClick={() => updatePracticeStatus('cancelled')}>Annuleren</button>
          {Date.parse(detail.startsAt) <= Date.now() && <button type="button" disabled={busy} onClick={() => updatePracticeStatus('no_show')}>Niet verschenen</button>}
          {Date.parse(detail.startsAt) > Date.now() && <button type="button" disabled={busy} onClick={() => openManual(detail.startsAt, detail.endsAt, detail.id)}>Verplaatsen</button>}
          {Date.parse(detail.endsAt) <= Date.now() && <button className="unified-agenda__save" type="button" disabled={busy} onClick={() => updatePracticeStatus('completed')}>Afronden</button>}
        </>}
        <span /><button type="button" onClick={() => setDetail(null)}>Sluiten</button>
      </footer>
    </section></div>}
    {block && mode === 'practice' && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setBlock(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="practice-agenda-block" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>Beschikbaarheid</p><h2 id="practice-agenda-block">Tijd blokkeren</h2></div><button type="button" onClick={() => setBlock(null)} aria-label="Sluiten">×</button></header>
      <div className="unified-agenda__fields"><label><span>Van</span><input type="datetime-local" value={block.startsAt} onChange={(event) => setBlock({ ...block, startsAt: event.target.value })} /></label><label><span>Tot</span><input type="datetime-local" value={block.endsAt} onChange={(event) => setBlock({ ...block, endsAt: event.target.value })} /></label><label className="is-wide"><span>Privénotitie (optioneel)</span><input maxLength={80} value={block.reason} onChange={(event) => setBlock({ ...block, reason: event.target.value })} placeholder="Bijv. verlof of opleiding" /></label>{notice && <p className="practice-agenda-form-error" role="alert">{notice}</p>}</div>
      <footer><span /><button type="button" onClick={() => setBlock(null)}>Annuleren</button><button className="unified-agenda__save" type="button" disabled={busy} onClick={saveBlock}>Blokkeren</button></footer>
    </section></div>}
    {manual && mode === 'practice' && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setManual(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="practice-agenda-manual" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>MyGrowise</p><h2 id="practice-agenda-manual">{manual.id ? 'Afspraak verplaatsen' : 'Afspraak inplannen'}</h2></div><button type="button" onClick={() => setManual(null)} aria-label="Sluiten">×</button></header>
      <div className="unified-agenda__fields">{!manual.id && <label className="is-wide"><span>Cliënt</span><select value={manual.patientId} onChange={(event) => setManual({ ...manual, patientId: event.target.value })}><option value="">Kies een cliënt met e-mailadres</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.email}</option>)}</select>{clientsLoading ? <small>Cliënten laden…</small> : !clients.length && <small>Geen toegewezen cliënten met e-mailadres gevonden. <a href="/admin/clienten">Open cliëntendossiers →</a></small>}</label>}{!manual.id&&<label><span>Afspraaktype</span><select value={manual.offerId} onChange={event=>setManual({...manual,offerId:event.target.value})}><option value="">Kies een afspraaktype</option>{offers.map(o=><option key={o.id} value={o.id}>{o.name} · {o.duration} min</option>)}</select></label>}<label><span>Van</span><input type="datetime-local" value={manual.startsAt} onChange={(event) => setManual({ ...manual, startsAt: event.target.value })} /></label><p>De eindtijd wordt automatisch bepaald door het afspraaktype. Bij verplaatsen blijft de oorspronkelijke duur behouden.</p>{notice && <p className="practice-agenda-form-error" role="alert">{notice}</p>}</div>
      <footer><span /><button type="button" onClick={() => setManual(null)}>Annuleren</button><button className="unified-agenda__save" type="button" disabled={busy} onClick={saveManual}>{manual.id ? 'Verplaatsen' : 'Inplannen'}</button></footer>
    </section></div>}
    {form && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setForm(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="agenda-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>{form.calendarScope === 'itransform' ? 'Praktijk Itransform' : 'MyGrowise'}</p><h2 id="agenda-editor-title">{form.id ? 'Moment aanpassen' : 'Nieuw moment'}</h2></div><button type="button" onClick={() => setForm(null)} aria-label="Sluiten">×</button></header>
      <div className="unified-agenda__fields">
        {canUseItransform && <label className="is-wide"><span>Agenda</span><select value={form.calendarScope} onChange={(event) => setForm({ ...form, calendarScope: event.target.value as FormValue['calendarScope'] })}><option value="mygrowise">MyGrowise</option><option value="itransform">Praktijk Itransform</option></select></label>}
        <label><span>Titel</span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bijv. cliëntafspraak" /></label>
        <label><span>Type</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Item['kind'] })}><option value="appointment">Afspraak</option><option value="block">Niet beschikbaar</option><option value="personal">Persoonlijk</option></select></label>
        {mode === 'admin' && <label><span>Professional</span><select required value={form.practitionerId || ''} onChange={(event) => setForm({ ...form, practitionerId: event.target.value || null, calendarScope: 'mygrowise' })}><option value="">Kies een professional</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
        <label><span>Van</span><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
        <label><span>Tot</span><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
        <label className="is-wide"><span>Locatie</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Praktijkruimte of online" /></label>
        <fieldset className="is-wide"><legend>Kleur</legend><div className="unified-agenda__colours">{colours.map((color) => <button key={color} type="button" aria-label={`Kleur ${color}`} aria-pressed={form.color === color} className={form.color === color ? 'is-selected' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })} />)}<label className="unified-agenda__custom-colour">Eigen kleur<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label></div></fieldset>
        {notice && <p className="practice-agenda-form-error" role="alert">{notice}</p>}
      </div>
      <footer>{form.id && <button className="unified-agenda__delete" type="button" disabled={busy} onClick={remove}>Verwijderen</button>}<span /><button type="button" onClick={() => setForm(null)}>Annuleren</button><button className="unified-agenda__save" type="button" disabled={busy} onClick={save}>Opslaan</button></footer>
    </section></div>}
  </div>;
}
