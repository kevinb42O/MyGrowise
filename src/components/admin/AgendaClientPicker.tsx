import { useEffect, useId, useState } from 'react';

type ClientChoice = { id: string; name: string; email: string };

export default function AgendaClientPicker({ mode, value, onChange, initial, name }: {
  mode: 'admin' | 'practice'; value?: string; onChange?: (id: string) => void; initial?: ClientChoice; name?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ clients: ClientChoice[]; hasMore: boolean }>({ clients: [], hasMore: false });
  const [selected, setSelected] = useState<ClientChoice | undefined>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const activeId = value ?? selected?.id ?? '';

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const endpoint = mode === 'admin' ? '/api/admin/agenda' : '/api/praktijk/agenda';
        const parameters = new URLSearchParams({ clients: '1', q: query, page: String(page) });
        const response = await fetch(`${endpoint}?${parameters}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Cliënten konden niet worden geladen.');
        const payload = await response.json();
        if (!controller.signal.aborted) {
          setResult(payload);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) setError('Cliënten konden niet worden geladen.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [mode, query, page, retry]);

  const options = selected && !result.clients.some(client => client.id === selected.id)
    ? [selected, ...result.clients] : result.clients;
  const changePage = (next: number) => { setPage(next); setLoading(true); };

  return <div className="agenda-client-picker is-wide">
    <label htmlFor={`${id}-search`}><span>Zoek cliënt</span></label>
    <input id={`${id}-search`} type="search" autoComplete="off" value={query} placeholder="Naam of e-mailadres…"
      onChange={event => { setQuery(event.target.value); setPage(0); setLoading(true); }} />
    <label htmlFor={id}><span>Cliënt</span></label>
    <select id={id} name={name} required value={activeId} onChange={event => {
      setSelected(options.find(client => client.id === event.target.value));
      onChange?.(event.target.value);
    }}>
      <option value="">Kies een cliënt met e-mailadres</option>
      {options.map(client => <option key={client.id} value={client.id}>{client.name}{client.email ? ` · ${client.email}` : ''}</option>)}
    </select>
    <div className="agenda-client-picker__status" role="status">
      {loading ? 'Cliënten laden…' : error || (!result.clients.length ? 'Geen cliënten gevonden.' : '')}
    </div>
    {error && <button type="button" onClick={() => { setLoading(true); setRetry(retry + 1); }}>Opnieuw laden</button>}
    {!loading && (page > 0 || result.hasMore) && <div className="agenda-client-picker__pages">
      <button type="button" disabled={!page} onClick={() => changePage(page - 1)}>Vorige</button>
      <span>Pagina {page + 1}</span>
      <button type="button" disabled={!result.hasMore} onClick={() => changePage(page + 1)}>Volgende</button>
    </div>}
  </div>;
}
