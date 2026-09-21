import { useCallback, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import nlLocale from '@fullcalendar/core/locales/nl';
import type { DateSelectArg, EventApi, EventChangeArg, EventClickArg, EventInput, EventSourceFuncArg } from '@fullcalendar/core';

type Source = 'mygrowise' | 'itransform';
type Item = { id: string; source: Source; title: string; subtitle: string; startsAt: string; endsAt: string; status: string; kind: 'appointment' | 'personal' | 'block'; location: string; color: string; editable: boolean };
type FormValue = { id?: string; title: string; startsAt: string; endsAt: string; kind: Item['kind']; location: string; color: string };

const colours = ['#d26479', '#d97706', '#7c3aed', '#2563eb', '#0891b2', '#15803d', '#374151', '#be123c'];
const toLocalInput = (value: Date | string) => {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const fromEvent = (event: EventApi): Item | null => event.extendedProps.item || null;

export default function UnifiedAgenda() {
  const calendarRef = useRef<FullCalendar>(null);
  const [source, setSource] = useState<'all' | Source>('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormValue | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(() => calendarRef.current?.getApi().refetchEvents(), []);
  const mapEvent = useCallback((item: Item): EventInput => ({
    id: item.id, title: item.title, start: item.startsAt, end: item.endsAt, editable: item.editable,
    backgroundColor: item.color, borderColor: item.color, textColor: '#ffffff',
    extendedProps: { item },
  }), []);
  const loadEvents = useCallback(async (info: EventSourceFuncArg, success: (events: EventInput[]) => void, failure: (error: Error) => void) => {
    try {
      const response = await fetch(`/api/admin/agenda?from=${encodeURIComponent(info.startStr)}&to=${encodeURIComponent(info.endStr)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Agenda kon niet laden.');
      const needle = search.trim().toLowerCase();
      success((payload.events as Item[]).filter((item) => (source === 'all' || item.source === source) && (!needle || `${item.title} ${item.subtitle} ${item.location}`.toLowerCase().includes(needle))).map(mapEvent));
    } catch (error) { failure(error instanceof Error ? error : new Error('Agenda kon niet laden.')); }
  }, [mapEvent, search, source]);
  const openNew = (start: Date, end?: Date) => setForm({ title: '', startsAt: toLocalInput(start), endsAt: toLocalInput(end || new Date(start.getTime() + 60 * 60 * 1000)), kind: 'appointment', location: 'Praktijk Itransform', color: '#d26479' });
  const openEdit = (item: Item) => setForm({ id: item.id, title: item.title, startsAt: toLocalInput(item.startsAt), endsAt: toLocalInput(item.endsAt), kind: item.kind, location: item.location, color: item.color });
  const save = async () => {
    if (!form) return;
    const startsAt = new Date(form.startsAt).toISOString(); const endsAt = new Date(form.endsAt).toISOString();
    if (new Date(endsAt) <= new Date(startsAt)) { setNotice('Het einduur moet na het beginuur vallen.'); return; }
    const response = await fetch(form.id ? `/api/admin/agenda?id=${encodeURIComponent(form.id)}` : '/api/admin/agenda', { method: form.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, startsAt, endsAt }) });
    const payload = await response.json();
    if (!response.ok) { setNotice(payload.error || 'Opslaan is niet gelukt.'); return; }
    setForm(null); setNotice(form.id ? 'Moment aangepast.' : 'Moment toegevoegd.'); refresh();
  };
  const updatePosition = async (change: EventChangeArg) => {
    const item = fromEvent(change.event);
    if (!item?.editable) { change.revert(); return; }
    const response = await fetch(`/api/admin/agenda?id=${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: item.title, kind: item.kind, location: item.location, color: item.color, startsAt: change.event.start?.toISOString(), endsAt: (change.event.end || new Date((change.event.start?.getTime() || 0) + 60 * 60 * 1000)).toISOString() }) });
    if (!response.ok) { change.revert(); setNotice('Verplaatsen is niet gelukt.'); } else { setNotice('Tijdstip aangepast.'); refresh(); }
  };
  const onEventClick = (click: EventClickArg) => { const item = fromEvent(click.event); if (!item) return; if (item.editable) openEdit(item); else { window.location.assign('/admin/boekingen'); } };
  const remove = async () => {
    if (!form?.id || !window.confirm(`Verwijder “${form.title}”?`)) return;
    const response = await fetch(`/api/admin/agenda?id=${encodeURIComponent(form.id)}`, { method: 'DELETE' });
    if (!response.ok) { setNotice('Verwijderen is niet gelukt.'); return; }
    setForm(null); setNotice('Moment verwijderd.'); refresh();
  };
  const chooseSource = (next: 'all' | Source) => { setSource(next); setTimeout(refresh, 0); };

  return <div className="unified-agenda">
    <div className="unified-agenda__controls">
      <div className="unified-agenda__source" role="group" aria-label="Agenda filter">
        {([['all', 'Alles'], ['mygrowise', 'MyGrowise'], ['itransform', 'Praktijk Itransform']] as const).map(([value, label]) => <button key={value} type="button" className={source === value ? 'is-active' : ''} onClick={() => chooseSource(value)}><i className={`source-dot source-dot--${value}`} />{label}</button>)}
      </div>
      <label className="unified-agenda__search"><span>Zoeken</span><input value={search} onChange={(event) => { setSearch(event.target.value); setTimeout(refresh, 150); }} placeholder="Naam, locatie of titel" /></label>
      <button type="button" className="unified-agenda__new" onClick={() => openNew(new Date())}>+ Nieuw moment</button>
    </div>
    {notice && <div className="unified-agenda__notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Melding sluiten">×</button></div>}
    <FullCalendar
      ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]} locale={nlLocale} timeZone="Europe/Brussels"
      initialView="timeGridWeek" firstDay={1} nowIndicator selectable selectMirror editable eventResizableFromStart eventDurationEditable
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
      buttonText={{ today: 'Vandaag', month: 'Maand', week: 'Week', day: 'Dag', list: 'Lijst' }}
      allDaySlot={false} slotMinTime="07:00:00" slotMaxTime="21:00:00" slotDuration="00:30:00" snapDuration="00:15:00" height="auto" expandRows
      events={loadEvents} dateClick={(arg) => openNew(arg.date)} select={(arg: DateSelectArg) => { openNew(arg.start, arg.end); calendarRef.current?.getApi().unselect(); }}
      eventClick={onEventClick} eventDrop={updatePosition} eventResize={updatePosition}
      eventContent={(arg) => <div className="unified-agenda__event"><b>{arg.timeText}</b><span>{arg.event.title}</span></div>}
    />
    {form && <div className="unified-agenda__backdrop" role="presentation" onMouseDown={() => setForm(null)}><section className="unified-agenda__editor" role="dialog" aria-modal="true" aria-labelledby="agenda-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p>Praktijk Itransform</p><h2 id="agenda-editor-title">{form.id ? 'Moment aanpassen' : 'Nieuw moment'}</h2></div><button type="button" onClick={() => setForm(null)} aria-label="Sluiten">×</button></header>
      <div className="unified-agenda__fields">
        <label><span>Titel</span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bijv. cliëntafspraak" /></label>
        <label><span>Type</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Item['kind'] })}><option value="appointment">Afspraak</option><option value="block">Niet beschikbaar</option><option value="personal">Persoonlijk</option></select></label>
        <label><span>Van</span><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
        <label><span>Tot</span><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
        <label className="is-wide"><span>Locatie</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Praktijkruimte of online" /></label>
        <fieldset className="is-wide"><legend>Kleur</legend><div className="unified-agenda__colours">{colours.map((color) => <button key={color} type="button" aria-label={`Kleur ${color}`} aria-pressed={form.color === color} className={form.color === color ? 'is-selected' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })} />)}<label className="unified-agenda__custom-colour">Eigen kleur<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label></div></fieldset>
      </div>
      <footer>{form.id && <button className="unified-agenda__delete" type="button" onClick={remove}>Verwijderen</button>}<span /><button type="button" onClick={() => setForm(null)}>Annuleren</button><button className="unified-agenda__save" type="button" onClick={save}>Opslaan</button></footer>
    </section></div>}
  </div>;
}
