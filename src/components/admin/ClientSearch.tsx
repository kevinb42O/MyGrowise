import { useEffect, useId, useRef, useState } from 'react';
import { highlightedParts } from '../../lib/clientSearchText';

type Client = { id: string; name: string; email: string | null; status: string };
const Match = ({ text, query }: { text: string; query: string }) => <>{highlightedParts(text, query).map((part, index) => part.match ? <mark key={index}>{part.text}</mark> : part.text)}</>;
export default function ClientSearch({ practice = false }: { practice?: boolean }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [result, setResult] = useState<{ key: string; clients: Client[]; hasMore: boolean }>({ key: '', clients: [], hasMore: false });
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [shortcut, setShortcut] = useState('Ctrl K');
  const base = practice ? '/praktijk/clienten' : '/admin/clienten';
  const term = query.trim();
  const key = JSON.stringify([term, includeArchived, revision]);
  const loading = fetching || result.key !== key;
  const clients = result.clients;
  const allHref = `${base}?${new URLSearchParams({ q: term, status: includeArchived ? 'all' : 'active' })}`;
  const focusResult = (index: number) => {
    const links = root.current?.querySelectorAll<HTMLAnchorElement>('[data-client-result]');
    if (!links?.length || loading || error) return;
    const link = links[Math.max(0, Math.min(links.length - 1, index))];
    link.focus();
    link.scrollIntoView({ block: 'nearest' });
  };
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setFetching(true); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/admin/clienten/zoeken', { method: 'POST', body: new URLSearchParams({ compact: '1', search: term, include_archived: includeArchived ? '1' : '0' }), signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.clients)) throw new Error();
        if (!controller.signal.aborted) setResult({ key, clients: data.clients, hasMore: Boolean(data.hasMore) });
      } catch {
        if (!controller.signal.aborted) { setError('Zoeken is niet gelukt. Probeer opnieuw.'); setResult({ key, clients: [], hasMore: false }); }
      } finally { if (!controller.signal.aborted) setFetching(false); }
    }, term ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [key, open]);
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const activate = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k' && input.current?.getClientRects().length) {
        event.preventDefault(); input.current.focus(); setOpen(true);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', activate);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', activate); };
  }, []);
  const status = loading ? 'Cliënten zoeken…' : error || (clients.length ? `${clients.length}${result.hasMore ? ' of meer' : ''} cliënten gevonden.` : term ? `Geen cliënten gevonden voor ‘${term}’.` : 'Nog geen recent geopende dossiers.');
  return <div ref={root} className="header-client-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); input.current?.focus(); setOpen(false); }
  }}>
    <div className="header-client-search__field">
    <label className="sr-only" htmlFor={id}>Zoek cliënt op naam of e-mailadres</label>
    <svg className="header-client-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
    <input ref={input} id={id} type="search" placeholder="Zoek op naam of e-mail…" autoComplete="off" spellCheck={false} maxLength={80} role="combobox" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? `${id}-panel` : undefined}
      value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); if (open) focusResult(event.key === 'ArrowDown' ? 0 : clients.length - 1); }
        if (event.key === 'Enter' && open && !loading && !error && clients.length === 1) { event.preventDefault(); window.location.assign(`${base}/${clients[0].id}`); }
      }} />
    {query ? <button className="header-client-search__clear" type="button" aria-label="Zoekopdracht wissen" onClick={() => { setQuery(''); input.current?.focus(); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button> : <kbd className="header-client-search__shortcut" aria-hidden="true">{shortcut}</kbd>}
    </div>
    {open && <div id={`${id}-panel`} className="client-search__panel" role="dialog" aria-label="Cliënten zoeken">
      <div className="client-search__heading"><strong>{term ? 'Zoekresultaten' : 'Recent geopende dossiers'}</strong><span aria-hidden="true">{loading ? 'Zoeken…' : error ? '' : `${clients.length}${result.hasMore ? '+' : ''} gevonden`}</span></div>
      <label className="client-search__filter"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />Ook gearchiveerde dossiers</label>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      <div className="client-search__results" aria-busy={loading}>
        {loading && <div className="client-search__progress" aria-hidden="true" />}
        {!error && clients.length > 0 && <ul inert={loading} className={loading ? 'is-pending' : undefined} aria-label={term ? 'Gevonden cliënten' : 'Recent geopende dossiers'}>
          {clients.map((client, index) => <li key={client.id} onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (event.key === 'ArrowUp' && index === 0) input.current?.focus(); else focusResult(index + (event.key === 'ArrowDown' ? 1 : -1)); }
          }}>
            <a data-client-result className="client-search__main" href={`${base}/${client.id}`}>
              <span className="client-search__avatar" aria-hidden="true">{client.name.trim().split(/\s+/).filter(Boolean).filter((_, i, words) => i === 0 || i === words.length - 1).map(word => Array.from(word)[0]).join('').toUpperCase()}</span>
              <span className="client-search__identity"><strong><Match text={client.name} query={term} /></strong><small><Match text={client.email || 'Geen e-mailadres'} query={term} /></small>{client.status === 'archived' && <span className="client-search__archived">Gearchiveerd</span>}</span>
              <svg className="client-search__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </a>
            <div className="client-search__links"><a href={`${base}/${client.id}?onderdeel=verslagen`} aria-label={`Verslagen van ${client.name}`}>Verslagen</a><a href={`${base}/${client.id}?onderdeel=afspraken`} aria-label={`Afspraken van ${client.name}`}>Afspraken</a></div>
          </li>)}
        </ul>}
        {(error || !clients.length) && <div className="client-search__empty"><strong>{loading ? 'Dossiers ophalen…' : error ? 'Zoeken tijdelijk niet beschikbaar' : term ? `Geen cliënten gevonden voor ‘${term}’` : 'Nog geen recente dossiers'}</strong><p>{loading ? 'Een ogenblik.' : error ? 'Probeer het opnieuw. Je zoekopdracht blijft behouden.' : term ? 'Pas je zoekterm aan of zoek op e-mailadres.' : 'Zoek op naam of e-mail om een dossier te openen.'}</p>{error && <button type="button" onClick={() => setRevision(value => value + 1)}>Opnieuw zoeken</button>}</div>}
      </div>
      <div className="client-search__footer">
        {term ? <a className="client-search__all" href={allHref}>Bekijk alle resultaten <span aria-hidden="true">→</span></a> : clients.length > 0 && <button type="button" disabled={clearing || loading} onClick={async () => {
          input.current?.focus();
          setClearing(true);
          try {
            const response = await fetch('/api/admin/clienten/zoeken', { method: 'POST', body: new URLSearchParams({ compact: '1', clear_recent: '1' }) });
            if (!response.ok) throw new Error();
            setRevision(value => value + 1);
          } catch { setError('Recente dossiers konden niet worden gewist.'); }
          finally { setClearing(false); }
        }}>{clearing ? 'Wissen…' : 'Recente lijst wissen'}</button>}
        <span className="client-search__keyboard-hint" aria-hidden="true">↑ ↓ kiezen · Enter openen · Esc sluiten</span>
      </div>
    </div>}
  </div>;
}
