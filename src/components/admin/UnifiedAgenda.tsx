import { useCallback, useRef, useState } from 'react';
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
type Item = { id: string; source: Source; title: string; subtitle: string; startsAt: string; endsAt: string; status: string; kind: 'appointment' | 'personal' | 'block' | 'availability'; location: string; color: string; editable: boolean; patientId?: string | null; practitionerId?: string | null };
type FormValue = { id?: string; title: string; startsAt: string; endsAt: string; kind: Item['kind']; location: string; color: string; practitionerId: string | null; calendarScope: 'mygrowise' | 'itransform' };
type BlockValue = { startsAt: string; endsAt: string; reason: string };
type ManualValue = { id?: string; patientId: string; startsAt: string; endsAt: string };
type ClientChoice = { id: string; name: string; email: string };

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

export default function UnifiedAgenda({ mode = 'admin', allowItransform = false }: { mode?: 'admin' | 'practice'; allowItransform?: boolean }) {
  const calendarRef = useRef<FullCalendar>(null);
  const [source, setSource] = useState<'all' | Source>('all');
  const [canUseItransform, setCanUseItransform] = useState(allowItransform);
  const [practitionerFilter, setPractitionerFilter] = useState('all');
  const [practitioners, setPractitioners] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormValue | null>(null);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<Item | null>(null);
  const [block, setBlock] = useState<BlockValue | null>(null);
  const [manual, setManual] = useState<ManualValue | null>(null);
  const [slotChoice, setSlotChoice] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [clients, setClients] = useState<ClientChoice[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => calendarRef.current?.getApi().refetchEvents(), []);
  const mapEvent = useCallback((item: Item): EventInput => ({
    id: `${item.source}:${item.id}`, title: item.title, start: item.startsAt, end: item.endsAt, editable: item.editable && mode === 'admin',
    display: item.source === 'availability' ? 'background' : 'auto',
    classNames: [`unified-agenda__item--${item.source}`, `unified-agenda__item--${item.status}`],
    backgroundColor: item.color, borderColor: item.color, textColor: '#ffffff',
    extendedProps: { item },
  }), [mode]);
  const loadEvents = useCallback(async (info: EventSourceFuncArg, success: (events: EventInput[]) => void, failure: (error: Error) => void) => {
    try {
      const endpoint = mode === 'practice' ? '/api/praktijk/agenda' : '/api/admin/agenda';
      const response = await fetch(`${endpoint}?from=${encodeURIComponent(info.startStr)}&to=${encodeURIComponent(info.endStr)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Agenda kon niet laden.');
      if (mode === 'admin') setPractitioners(payload.practitioners || []);
      else setCanUseItransform(payload.canUseItransform === true);
      const needle = search.trim().toLowerCase();
      success((payload.events as Item[]).filter((item) => (source === 'all' || item.source === source || (mode === 'practice' && source === 'mygrowise' && (item.source === 'block' || item.source === 'availability'))) && (mode === 'practice' || practitionerFilter === 'all' || item.practitionerId === practitionerFilter) && (item.source === 'availability' || !needle || `${item.title} ${item.subtitle} ${item.location}`.toLowerCase().includes(needle))).map(mapEvent));
    } catch (error) {
      const failureError = error instanceof Error ? error : new Error('Agenda kon niet laden.');
      setNotice(failureError.message);
      failure(failureError);
    }
  }, [mapEvent, mode, practitionerFilter, search, source]);
  const openNew = (start: Date | string, end?: Date | string) => {
    const selectedPractitioner = practitioners.find((person) => person.id === practitionerFilter);
    const adminUsesMyGrowise = source === 'mygrowise'
      || (practitionerFilter !== 'all' && !(source === 'itransform' && selectedPractitioner?.slug === 'virginie'));
    const calendarScope = mode === 'practice'
      ? canUseItransform && source === 'itransform' ? 'itransform' : 'mygrowise'
      : adminUsesMyGrowise ? 'mygrowise' : 'itransform';
    setNotice('');
    setForm({ title: '', startsAt: toLocalInput(start), endsAt: toLocalInput(end || oneHourLater(start)),
      kind: mode === 'practice' ? 'personal' : 'appointment', location: mode === 'practice' ? '' : calendarScope === 'itransform' ? 'Praktijk Itransform' : '',
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
    setManual({ id, patientId: '', startsAt: toLocalInput(start), endsAt: toLocalInput(end || oneHourLater(start)) });
    if (id || clients.length) return;
    setClientsLoading(true);
    fetch('/api/praktijk/agenda?clients=1').then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Cliënten konden niet worden geladen.');
      setClients(payload.clients || []);
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
      const startsAt = toUtcIso(manual.startsAt); const endsAt = toUtcIso(manual.endsAt);
      if (endsAt <= startsAt || (!manual.id && !manual.patientId)) throw new Error('Kies een cliënt en controleer begin- en eindtijd.');
      practiceAction(manual.id ? 'reschedule' : 'manual', { id: manual.id || '', patientId: manual.patientId, startsAt, endsAt });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Controleer het tijdstip.'); }
  };
  const chooseSlot = (start: Date | string, end?: Date | string) => {
    setNotice('');
    setSlotChoice({ startsAt: toLocalInput(start), endsAt: toLocalInput(end || oneHourLater(start)) });
  };
  const nextQuarter = () => new Date(Math.ceil((Date.now() + 300000) / 900000) * 900000);

  return <div className="unified-agenda">
    <div className="unified-agenda__controls">
      {(mode === 'admin' || canUseItransform) && <div className="unified-agenda__source" role="group" aria-label="Agenda filter">
        {([['all', 'Alles'], ['mygrowise', 'MyGrowise'], ['itransform', 'Praktijk Itransform']] as const).map(([value, label]) => <button key={value} type="button" className={source === value ? 'is-active' : ''} onClick={() => chooseSource(value)}><i className={`source-dot source-dot--${value}`} />{label}</button>)}
      </div>}
      {mode === 'admin' && <label className="unified-agenda__search"><span>Professional</span><select value={practitionerFilter} onChange={(event) => { setPractitionerFilter(event.target.value); setTimeout(refresh, 0); }}><option value="all">Iedereen</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
      <label className="unified-agenda__search"><span>Zoeken</span><input value={search} onChange={(event) => { setSearch(event.target.value); setTimeout(refresh, 150); }} placeholder="Naam, locatie of titel" /></label>
      <button type="button" className="unified-agenda__new" onClick={() => mode === 'practice' ? openBlock(new Date()) : openNew(new Date())}>{mode === 'practice' ? '+ Tijd blokkeren' : '+ Nieuw moment'}</button>
      {mode === 'practice' && <button type="button" className="unified-agenda__new" onClick={() => openManual(nextQuarter())}>+ Cliëntafspraak</button>}
      {mode === 'practice' && <button type="button" className="unified-agenda__new" onClick={() => openNew(nextQuarter())}>+ Moment</button>}
      {mode === 'practice' && <a className="unified-agenda__new" href="/praktijk/beschikbaarheid">Weekschema</a>}
    </div>
    {notice && <div className="unified-agenda__notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Melding sluiten">×</button></div>}
    <FullCalendar
      ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxon3Plugin]} locale={nlLocale} timeZone="Europe/Brussels"
      initialView={typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches ? 'timeGridDay' : 'timeGridWeek'} firstDay={1} nowIndicator selectable selectMirror editable eventResizableFromStart eventDurationEditable
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
      buttonText={{ today: 'Vandaag', month: 'Maand', week: 'Week', day: 'Dag', list: 'Lijst' }}
      allDaySlot={false} slotMinTime="07:00:00" slotMaxTime="21:00:00" slotDuration="00:30:00" snapDuration="00:15:00" height="auto" expandRows
      events={loadEvents} dateClick={(arg) => mode === 'practice' ? chooseSlot(arg.dateStr) : openNew(arg.dateStr)} select={(arg: DateSelectArg) => { mode === 'practice' ? chooseSlot(arg.startStr, arg.endStr) : openNew(arg.startStr, arg.endStr); calendarRef.current?.getApi().unselect(); }}
      eventClick={onEventClick} eventDrop={updatePosition} eventResize={updatePosition}
      eventContent={(arg) => arg.event.extendedProps.item?.source === 'availability' ? null : <div className="unified-agenda__event"><b>{arg.timeText}</b><span>{arg.event.extendedProps.item?.status === 'pending' ? 'Aanvraag · ' : mode === 'practice' && canUseItransform && arg.event.extendedProps.item?.source === 'itransform' ? 'Itransform · ' : ''}{arg.event.title}</span></div>}
    />
    {slotChoice && mode === 'practice' && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setSlotChoice(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="practice-agenda-choice" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>Gekozen tijdvak</p><h2 id="practice-agenda-choice">Wat wil je plannen?</h2></div><button type="button" onClick={() => setSlotChoice(null)} aria-label="Sluiten">×</button></header>
      <div className="practice-agenda-choice"><button type="button" onClick={() => openManual(slotChoice.startsAt, slotChoice.endsAt)}><strong>MyGrowise-cliëntafspraak</strong><span>Koppel aan een toegewezen cliënt.</span></button><button type="button" onClick={() => { setSlotChoice(null); openNew(slotChoice.startsAt, slotChoice.endsAt); }}><strong>Eigen moment of privétijd</strong><span>Kies een titel, type en {canUseItransform ? 'organisatie' : 'kleur'}.</span></button><button type="button" onClick={() => openBlock(slotChoice.startsAt, slotChoice.endsAt)}><strong>MyGrowise-tijd blokkeren</strong><span>Maak dit moment niet meer publiek boekbaar.</span></button></div>
    </section></div>}
    {detail && mode === 'practice' && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setDetail(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="practice-agenda-detail" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>{detail.source === 'mygrowise' ? detail.status === 'pending' ? 'Nieuwe aanvraag' : 'Bevestigde afspraak' : detail.source === 'itransform' ? 'Praktijk Itransform' : 'Niet beschikbaar'}</p><h2 id="practice-agenda-detail">{detail.title}</h2></div><button type="button" onClick={() => setDetail(null)} aria-label="Sluiten">×</button></header>
      <div className="practice-agenda-detail"><strong>{new Intl.DateTimeFormat('nl-BE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(new Date(detail.startsAt))} – {new Intl.DateTimeFormat('nl-BE', { timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(new Date(detail.endsAt))}</strong><span>{detail.subtitle}</span>{detail.patientId && <a href={`/admin/clienten/${detail.patientId}`}>Open cliëntendossier →</a>}{notice && <p role="alert">{notice}</p>}</div>
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
      <div className="unified-agenda__fields">{!manual.id && <label className="is-wide"><span>Cliënt</span><select value={manual.patientId} onChange={(event) => setManual({ ...manual, patientId: event.target.value })}><option value="">Kies een cliënt met e-mailadres</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.email}</option>)}</select>{clientsLoading ? <small>Cliënten laden…</small> : !clients.length && <small>Geen toegewezen cliënten met e-mailadres gevonden. <a href="/admin/clienten">Open cliëntendossiers →</a></small>}</label>}<label><span>Van</span><input type="datetime-local" value={manual.startsAt} onChange={(event) => setManual({ ...manual, startsAt: event.target.value })} /></label><label><span>Tot</span><input type="datetime-local" value={manual.endsAt} onChange={(event) => setManual({ ...manual, endsAt: event.target.value })} /></label>{notice && <p className="practice-agenda-form-error" role="alert">{notice}</p>}</div>
      <footer><span /><button type="button" onClick={() => setManual(null)}>Annuleren</button><button className="unified-agenda__save" type="button" disabled={busy} onClick={saveManual}>{manual.id ? 'Verplaatsen' : 'Inplannen'}</button></footer>
    </section></div>}
    {form && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setForm(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="agenda-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>{form.calendarScope === 'itransform' ? 'Praktijk Itransform' : 'MyGrowise'}</p><h2 id="agenda-editor-title">{form.id ? 'Moment aanpassen' : 'Nieuw moment'}</h2></div><button type="button" onClick={() => setForm(null)} aria-label="Sluiten">×</button></header>
      <div className="unified-agenda__fields">
        {(mode === 'admin' || canUseItransform) && <label className="is-wide"><span>Agenda</span><select value={form.calendarScope} onChange={(event) => setForm({ ...form, calendarScope: event.target.value as FormValue['calendarScope'] })}><option value="mygrowise">MyGrowise</option><option value="itransform" disabled={mode === 'admin' && Boolean(form.practitionerId) && practitioners.find((person) => person.id === form.practitionerId)?.slug !== 'virginie'}>Praktijk Itransform</option></select></label>}
        <label><span>Titel</span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bijv. cliëntafspraak" /></label>
        <label><span>Type</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Item['kind'] })}><option value="appointment">Afspraak</option><option value="block">Niet beschikbaar</option><option value="personal">Persoonlijk</option></select></label>
        {mode === 'admin' && <label><span>Professional</span><select value={form.practitionerId || ''} onChange={(event) => { const practitionerId = event.target.value || null; const person = practitioners.find((entry) => entry.id === practitionerId); setForm({ ...form, practitionerId, calendarScope: practitionerId && person?.slug !== 'virginie' ? 'mygrowise' : !practitionerId ? 'itransform' : form.calendarScope }); }}><option value="">Niet toegewezen</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
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
