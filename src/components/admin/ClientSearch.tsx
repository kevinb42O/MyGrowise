import { useEffect, useId, useRef, useState } from 'react';
type Client = { id: string; name: string; email: string | null; status: string };
export default function ClientSearch({ practice = false }: { practice?: boolean }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const [revision, setRevision] = useState(0);
  const base = practice ? '/praktijk/clienten' : '/admin/clienten';
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setActive(-1); setError(''); setClients([]);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/admin/clienten/zoeken', { method: 'POST', body: new URLSearchParams({ compact: '1', search: query }), signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setClients(data.clients || []);
      } catch { if (!controller.signal.aborted) setError('Zoeken is niet gelukt. Probeer opnieuw.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, open, revision]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <div ref={root} className="header-client-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="sr-only" htmlFor={id}>Zoek cliënt op naam of e-mailadres</label>
    <svg className="header-client-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
    <input id={id} type="search" placeholder="Zoek cliënt…" autoComplete="off" maxLength={80} role="combobox" aria-expanded={open}
      aria-controls={`${id}-results`} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
      value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(value => Math.max(0, Math.min(clients.length - 1, value + (event.key === 'ArrowDown' ? 1 : -1)))); }
        if (event.key === 'Enter' && open && active >= 0 && clients[active]) window.location.assign(`${base}/${clients[active].id}`);
      }} />
    {open && <div className="client-search__panel">
      <strong>{query.trim() ? 'Cliënten' : 'Recent geraadpleegd'}</strong>
      <p role="status">{loading ? 'Cliënten zoeken…' : error || (!clients.length ? query.trim() ? 'Geen cliënten gevonden.' : 'Nog geen recente dossiers.' : '')}</p>
      <ul id={`${id}-results`} role="listbox" aria-label="Gevonden cliënten">
        {clients.map((client, index) => <li key={client.id} id={`${id}-${index}`} role="option" aria-selected={index === active}>
          <a href={`${base}/${client.id}`}><strong>{client.name}</strong><small>{client.email || 'Geen e-mailadres'}{client.status === 'archived' ? ' · Gearchiveerd' : ''}</small></a>
          <div className="client-search__links"><a href={`${base}/${client.id}#verslagen`}>Notities</a><a href={`${base}/${client.id}#afspraken`}>Afspraken</a></div>
        </li>)}
      </ul>
      {error && <button type="button" onClick={() => setRevision(value => value + 1)}>Opnieuw zoeken</button>}
      {!query.trim() && clients.length > 0 && <button type="button" onClick={async () => {
        try {
          const response = await fetch('/api/admin/clienten/zoeken', { method: 'POST', body: new URLSearchParams({ compact: '1', clear_recent: '1' }) });
          if (!response.ok) throw new Error();
          setRevision(value => value + 1);
        } catch { setError('Recente cliënten konden niet worden gewist.'); }
      }}>Recente cliënten wissen</button>}
    </div>}
  </div>;
}
