import { useEffect, useId, useState } from 'react';
export type NewPatient = { firstName: string; lastName: string; email: string; birthDate: string; key: string };
type ClientChoice = { id: string; name: string; email: string; accountLinked?: boolean };
export default function AgendaClientPicker({ mode, value, onChange, initial, name, onNewChange, initialNew }: {
  mode: 'admin' | 'practice'; value?: string; onChange?: (id: string) => void; initial?: ClientChoice; name?: string;
  onNewChange?: (patient?: NewPatient) => void; initialNew?: NewPatient;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ clients: ClientChoice[]; hasMore: boolean }>({ clients: [], hasMore: false });
  const [selected, setSelected] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(!initial);
  const [active, setActive] = useState(-1);
  const [creating, setCreating] = useState(Boolean(initialNew));
  const [newPatient, setNewPatient] = useState<NewPatient>(initialNew || { firstName: '', lastName: '', email: '', birthDate: '', key: '' });
  const activeId = value ?? selected?.id ?? '';
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setResult({ clients: [], hasMore: false }); setActive(-1);
    const timer = window.setTimeout(async () => {
      try {
        const endpoint = mode === 'admin' ? '/api/admin/agenda' : '/api/praktijk/agenda';
        const response = await fetch(`${endpoint}?${new URLSearchParams({ clients: '1', q: query, page: String(page) })}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const payload = await response.json();
        if (!controller.signal.aborted) { setResult(payload); setError(''); }
      } catch { if (!controller.signal.aborted) setError('Cliënten konden niet worden geladen.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [mode, query, page, retry]);
  const choose = (client: ClientChoice) => { setSelected(client); onChange?.(client.id); document.getElementById(`${id}-search`)?.focus(); setOpen(false); };
  const patchNew = (patch: Partial<NewPatient>) => { const next = { ...newPatient, ...patch }; setNewPatient(next); onNewChange?.(next); };
  return <div className="agenda-client-picker is-wide">
    <div className="client-picker-tabs"><button type="button" aria-pressed={!creating} onClick={() => { setCreating(false); onNewChange?.(undefined); }}>Bestaande cliënt</button>
      <button type="button" aria-pressed={creating} onClick={() => {
        const next = { ...newPatient, key: newPatient.key || crypto.randomUUID() };
        setCreating(true); setNewPatient(next); onChange?.(''); setSelected(undefined); onNewChange?.(next);
      }}>Nieuwe cliënt</button></div>
    {creating ? <div className="practice-grid">
      <input type="hidden" name="submission_key" value={newPatient.key} />
      <label>Voornaam<input name="new_first_name" required maxLength={60} autoComplete="given-name" value={newPatient.firstName} onChange={event => patchNew({ firstName: event.target.value })} /></label>
      <label>Achternaam<input name="new_last_name" required maxLength={60} autoComplete="family-name" value={newPatient.lastName} onChange={event => patchNew({ lastName: event.target.value })} /></label>
      <label>E-mailadres<input name="new_email" type="email" required maxLength={254} autoComplete="off" value={newPatient.email} onChange={event => patchNew({ email: event.target.value })} /></label>
      <label>Geboortedatum<input name="new_birth_date" type="date" required min="1900-01-01" value={newPatient.birthDate} onChange={event => patchNew({ birthDate: event.target.value })} /></label>
      <p className="is-wide">De overige dossiergegevens kun je later aanvullen. Controleer eerst of deze cliënt al bestaat.</p>
    </div> : <div onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input type="hidden" name={name} value={activeId} />
    <label htmlFor={`${id}-search`}><span>Zoek cliënt</span></label>
    <input id={`${id}-search`} type="search" autoComplete="off" value={query} placeholder="Voornaam, familienaam of e-mailadres…"
      role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && active>=0 ? `${id}-option-${active}` : undefined}
      onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setPage(0); setOpen(true); }}
      onKeyDown={event => {
        if(event.key==='Escape'&&open){event.stopPropagation();setOpen(false);}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(value=>Math.max(0,Math.min(result.clients.length-1,value+(event.key==='ArrowDown'?1:-1))));}
        if(event.key==='Enter'&&open){event.preventDefault();if(active>=0&&result.clients[active])choose(result.clients[active]);}
      }}/>
    {open&&<ul id={`${id}-options`} role="listbox" aria-label="Cliënten">
      {result.clients.map((client,index)=><li key={client.id} id={`${id}-option-${index}`} role="option" aria-selected={active===index}>
        <button type="button" onClick={()=>choose(client)}><strong>{client.name}</strong><small>{client.email}</small></button>
      </li>)}
    </ul>}
    <p role="status">{selected&&activeId ? `Geselecteerd: ${selected.name} · ${selected.email}` : 'Kies een cliënt om de afspraak te plannen.'}</p>
    {selected&&activeId&&selected.accountLinked===false&&<p>Dit dossier heeft nog geen gekoppeld cliëntaccount. Koppel het account in het dossier, zodat de afspraak ook in ‘Mijn begeleiding’ verschijnt. <a href={`${mode==='practice'?'/praktijk':'/admin'}/clienten/${selected.id}`}>Dossier openen</a></p>}
    <div className="agenda-client-picker__status" role="status">{loading ? 'Cliënten laden…' : error || (!result.clients.length ? 'Geen cliënten gevonden.' : '')}</div>
      {error && <button type="button" onClick={() => setRetry(retry + 1)}>Opnieuw laden</button>}
      {open && !loading && (page > 0 || result.hasMore) && <div className="agenda-client-picker__pages">
        <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>Vorige</button><span>Pagina {page + 1}</span>
        <button type="button" disabled={!result.hasMore} onClick={() => setPage(page + 1)}>Volgende</button>
      </div>}
    </div>}
  </div>;
}
