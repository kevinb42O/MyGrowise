import { useEffect, useRef, useState } from 'react';
import {
  UPDATE_STATES,
  UPDATE_CATEGORIES,
  updateDate,
  type PlatformUpdate,
  type UpdateEvent,
  type UpdateComment,
  type UpdateState,
} from '../../lib/platformUpdateTypes';
import '../../styles/platform-updates.css';
const endpoint = '/api/admin/updates';
const labels = { received: 'Ontvangen', handling: 'In behandeling', answered: 'Beantwoord' };
function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={back ? { transform: 'rotate(180deg)' } : undefined}
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
function Status({ value }: { value: UpdateState }) {
  return (
    <span className={`up-status up-status--${value}`}>
      <span />
      {UPDATE_STATES[value]}
    </span>
  );
}
async function api(params: Record<string, string> = {}, signal?: AbortSignal) {
  const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, { signal });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'De updates konden niet worden geladen.');
  return data;
}
async function mutate(action: string, id: string | undefined, data: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, id, data }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Opslaan is niet gelukt.');
  return result;
}
function Pager({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (p: number) => void;
}) {
  if (total <= size) return null;
  return (
    <nav className="up-pages" aria-label="Pagina’s">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        Vorige
      </button>
      <span>
        Pagina {page} van {Math.ceil(total / size)}
      </span>
      <button disabled={page * size >= total} onClick={() => onChange(page + 1)}>
        Volgende
      </button>
    </nav>
  );
}
export default function UpdatesWorkspace({
  slug,
  userId,
  canManage = false,
  initialParams = '',
}: {
  slug?: string;
  userId: string;
  canManage?: boolean;
  initialParams?: string;
}) {
  const initial = new URLSearchParams(initialParams);
  const [audience, setAudience] = useState(initial.get('audience') || 'all');
  const [filter, setFilter] = useState(initial?.get('filter') || 'all'),
    [query, setQuery] = useState(initial?.get('q') || ''),
    [search, setSearch] = useState(initial?.get('q') || ''),
    [unread, setUnread] = useState(initial?.get('unread') === '1'),
    [page, setPage] = useState(Number(initial?.get('page')) || 1);
  const [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0),
    [eventPage, setEventPage] = useState(Number(initial.get('events')) || 1),
    [commentPage, setCommentPage] = useState(1),
    [editor, setEditor] = useState<'create' | 'edit' | 'event' | null>(null);
  const [message, setMessage] = useState(''),
    [readError, setReadError] = useState('');
  useEffect(() => {
    if (query === search) return;
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const control = new AbortController();
    setLoading(true);
    setError('');
    const params: Record<string, string> = slug
      ? { slug, events: String(eventPage), comments: String(commentPage) }
      : { filter, audience, q: search, unread: unread ? '1' : '0', page: String(page) };
    if (!slug) {
      const next = new URL(location.href);
      next.search = new URLSearchParams(params).toString();
      history.replaceState(null, '', next);
    }
    api(params, control.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => control.abort();
  }, [slug, filter, audience, search, unread, page, eventPage, commentPage, reload]);
  const item: PlatformUpdate | undefined = data?.item;
  useEffect(() => {
    if (!item || loading) return;
    let active = true;
    // Only after React has committed the detail, and only while actually visible.
    const mark = () => {
      if (document.visibilityState !== 'visible') return;
      mutate('read', item.id, {
        revision: Math.max(
          item.content_revision || 1,
          ...data.events.map((event: UpdateEvent) => event.revision || 1),
          ...data.comments.map((comment: UpdateComment) => comment.revision || 1),
        ),
      })
        .then(() => {
          if (active) {
            setReadError('');
            window.dispatchEvent(new Event('updates-read'));
          }
        })
        .catch(() => {
          if (active) setReadError('Je gelezen-status kon niet worden bewaard.');
        });
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', mark);
    };
  }, [item?.id, item?.revision, loading]);
  useEffect(() => {
    if (!loading && data && location.hash.startsWith('#milestone-'))
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center' });
  }, [loading, data]);
  const refresh = () => setReload((v) => v + 1);
  return (
    <div className="up-workspace">
      <header className={`up-heading ${slug ? 'up-heading--detail' : ''}`}>
        <div>
          {slug && (
            <a className="up-back" href="/admin/updates">
              <Arrow back /> Alle updates
            </a>
          )}
          <h1>
            {slug ? (
              item?.title || 'Een volgende stap voor MyGrowise'
            ) : (
              <>
                MyGrowise blijft
                <br />
                <em>groeien.</em>
              </>
            )}
          </h1>
          <p>
            {slug
              ? item?.summary
              : 'Van een eerste idee tot iets dat je elke dag helpt. Hier volg je de verbeteringen aan jouw MyGrowise.'}
          </p>
        </div>
        {!slug && (
          <div className="up-intro-note">
            <span className="up-note-line" />
            <p>
              Een plek om mee te kijken,
              <br />
              mee te denken en bij te blijven.
            </p>
            <span>Voor jou, Virginie</span>
          </div>
        )}
      </header>
      {message && (
        <p className="up-notice" role="status">
          {message}
        </p>
      )}
      {readError && (
        <p className="up-error" role="status">
          {readError}{' '}
          <button
            onClick={() => {
              setReload((v) => v + 1);
            }}
          >
            Opnieuw proberen
          </button>
        </p>
      )}
      {!slug && (
        <>
          <div className="up-toolbar">
            <nav className="up-tabs" aria-label="Updates filteren">
              {[
                ['all', 'Alles'],
                ['active', 'In ontwikkeling'],
                ['released', 'Beschikbaar'],
                ['history', 'Terugblik'],
                ...(canManage ? [['drafts', 'Concepten']] : []),
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            {canManage && (
              <button className="up-editor-link" onClick={() => setEditor('create')}>
                Nieuwe update <span aria-hidden="true">+</span>
              </button>
            )}
          </div>
          <div className="up-audience-row">
            <span>Ik wil updates zien over</span>
            <div role="group" aria-label="Omgeving">
              {[
                ['all', 'Alles'],
                ['website', 'Website'],
                ['dashboard', 'Dashboard'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={audience === key}
                  onClick={() => {
                    setAudience(key);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="up-search-row">
            <label className="up-search">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 5 5" />
              </svg>
              <span className="sr-only">Zoek in updates</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek een verbetering…"
              />
            </label>
            <label className="up-check">
              <input
                type="checkbox"
                checked={unread}
                onChange={(e) => {
                  setUnread(e.target.checked);
                  setPage(1);
                }}
              />{' '}
              Alleen nieuw
            </label>
            <span className="up-result-count" aria-live="polite">
              {!loading &&
                !error &&
                `${data?.total || 0} ${data?.total === 1 ? 'onderwerp' : 'onderwerpen'}`}
            </span>
          </div>
        </>
      )}
      {loading ? (
        <div className="up-loading" role="status">
          <span />
          Even bijpraten…
        </div>
      ) : error ? (
        <div className="up-empty" role="alert">
          <h2>We konden de updates niet ophalen.</h2>
          <p>{error}</p>
          <button className="up-button" onClick={refresh}>
            Opnieuw proberen
          </button>
        </div>
      ) : slug && item ? (
        <>
          <div className="up-detail-grid">
            <div className="up-reading">
              <section className="up-story">
                <h2>Wat verandert er voor jou?</h2>
                <p className="up-prose">{item.body}</p>
                {item.action_path && (
                  <a className="up-button" href={item.action_path}>
                    {item.action_label}
                    <Arrow />
                  </a>
                )}
              </section>
              <section className="up-journey" aria-labelledby="journey-title">
                <div className="up-section-title">
                  <h2 id="journey-title">
                    Van idee tot {item.status === 'historical' ? 'vandaag' : 'beschikbaar'}
                  </h2>
                  <span>Stap voor stap</span>
                </div>
                <ol className="up-timeline">
                  {data.events.map((event: UpdateEvent, i: number) => (
                    <li key={event.id} id={`milestone-${event.id}`}>
                      <div className="up-timeline-dot" />
                      <div>
                        <time dateTime={event.created_at}>{updateDate(event.created_at)}</time>
                        <h3>{event.title}</h3>
                        <p className="up-prose">{event.body}</p>
                        <Status value={event.status} />
                      </div>
                    </li>
                  ))}
                </ol>
                <Pager page={eventPage} total={data.eventCount} size={20} onChange={setEventPage} />
              </section>
              <section className="up-conversation" aria-labelledby="feedback-title">
                <div className="up-section-title">
                  <h2 id="feedback-title">Samen maken we het beter.</h2>
                  <span>
                    {data.commentCount} {data.commentCount === 1 ? 'reactie' : 'reacties'}
                  </span>
                </div>
                <p>
                  Een vraag, een idee of iets dat nog niet helemaal goed voelt? Laat het hier weten.
                </p>
                {data.comments.length === 0 ? (
                  <p className="up-conversation-empty">Dit gesprek begint bij jou.</p>
                ) : (
                  <ol className="up-comments">
                    {data.comments.map((comment: UpdateComment) => (
                      <li key={comment.id} className={comment.author_id === userId ? 'is-own' : ''}>
                        <div className="up-comment-author">
                          <span className="up-avatar">
                            {comment.author_name.trim().slice(0, 1).toUpperCase()}
                          </span>
                          <strong>{comment.author_name}</strong>
                          <time dateTime={comment.created_at}>
                            {updateDate(comment.created_at)}
                          </time>
                        </div>
                        {comment.reply_to && (
                          <span className="up-reply-label">Antwoord op een eerdere reactie</span>
                        )}
                        <p className="up-prose">{comment.body}</p>
                        {comment.event && (
                          <a
                            className="up-milestone-link"
                            href={`/admin/updates/${item.slug}?events=${Math.ceil(comment.event.position / 20)}#milestone-${comment.event.id}`}
                          >
                            Verwerkt in: {comment.event.title} <Arrow />
                          </a>
                        )}
                        {!comment.reply_to && (
                          <div className="up-comment-footer">
                            <span>{labels[comment.feedback_status]}</span>
                            {canManage && comment.author_id !== userId && (
                              <>
                                <button
                                  onClick={() => {
                                    document.getElementById('feedback-body')?.focus();
                                    document.dispatchEvent(
                                      new CustomEvent('update-reply', { detail: comment }),
                                    );
                                  }}
                                >
                                  Antwoorden
                                </button>
                                {comment.feedback_status !== 'answered' && (
                                  <FeedbackStatus
                                    itemId={item.id}
                                    comment={comment}
                                    onDone={refresh}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                <Pager
                  page={commentPage}
                  total={data.commentCount}
                  size={20}
                  onChange={setCommentPage}
                />
                <FeedbackForm
                  events={data.events}
                  item={item}
                  onDone={(notification) => {
                    setMessage(
                      notification === 'sent'
                        ? 'Je reactie is opgeslagen en naar de webdesigner gemaild.'
                        : notification === 'pending'
                          ? 'Je reactie is opgeslagen. De melding aan de webdesigner staat klaar voor verzending.'
                          : 'Je reactie is opgeslagen. Je vindt de opvolging hier terug.',
                    );
                    setCommentPage(Math.ceil((data.commentCount + 1) / 20));
                    refresh();
                  }}
                />
              </section>
            </div>
            <aside className="up-aside">
              <div className="up-current">
                <span className="up-small-label">Waar staan we nu?</span>
                <Status value={item.status} />
                <p>
                  {item.next_step ||
                    'Nieuwe ontwikkelingen lees je hier zodra er een volgende stap is.'}
                </p>
                {item.status === 'historical' && (
                  <p className="up-history-note">
                    Een terugblik op de vastgelegde projectgeschiedenis. Dit is geen actuele
                    beschikbaarheidscontrole.
                  </p>
                )}
                <dl>
                  <div>
                    <dt>Onderdeel</dt>
                    <dd>{item.category}</dd>
                  </div>
                  <div>
                    <dt>Laatst bijgewerkt</dt>
                    <dd>{updateDate(item.updated_at)}</dd>
                  </div>
                </dl>
                {!item.published && (
                  <p className="up-draft-note">Concept · alleen zichtbaar via redactie</p>
                )}
              </div>
              <div className="up-aside-note">
                <h3>Jouw blik maakt verschil.</h3>
                <p>Met jouw ervaring maken we MyGrowise steeds fijner om mee te werken.</p>
                <a href="#feedback-title">
                  Deel je feedback <Arrow />
                </a>
              </div>
              {canManage && (
                <details className="up-management">
                  <summary>Update beheren</summary>
                  <button onClick={() => setEditor('edit')}>Tekst & publicatie bewerken</button>
                  <button onClick={() => setEditor('event')}>Volgende mijlpaal toevoegen</button>
                </details>
              )}
            </aside>
          </div>
        </>
      ) : !slug ? (
        <section className="up-list" aria-label="Verbeteringen">
          {data?.items?.length ? (
            data.items.map((update: PlatformUpdate) => (
              <a
                className={`up-row ${update.status === 'in_progress' ? 'up-row--active' : ''}`}
                href={`/admin/updates/${update.slug}`}
                key={update.id}
              >
                <div className="up-row-date">
                  <span>{update.category}</span>
                  <time dateTime={update.updated_at}>{updateDate(update.updated_at)}</time>
                </div>
                <div className="up-row-main">
                  <div className="up-row-labels">
                    <Status value={update.status} />
                    {update.unread && <span className="up-new">Nieuw</span>}
                  </div>
                  <h2>{update.title}</h2>
                  <p>{update.summary}</p>
                </div>
                <span className="up-row-arrow">
                  <Arrow />
                </span>
              </a>
            ))
          ) : (
            <div className="up-empty">
              <h2>
                {search || unread ? 'Geen updates gevonden.' : 'De volgende stap begint hier.'}
              </h2>
              <p>
                {search || unread
                  ? 'Probeer een andere zoekterm of toon ook gelezen updates.'
                  : 'Zodra er iets nieuws is, lees je het hier.'}
              </p>
              {(search || unread) && (
                <button
                  className="up-button"
                  onClick={() => {
                    setQuery('');
                    setUnread(false);
                  }}
                >
                  Filters wissen
                </button>
              )}
            </div>
          )}
          <Pager page={page} total={data?.total || 0} size={12} onChange={setPage} />
        </section>
      ) : null}
      {!slug && (
        <footer className="up-footer">
          <span>Met aandacht gemaakt. Samen verder.</span>
          <span>MyGrowise</span>
        </footer>
      )}
      {editor && (
        <UpdateEditor
          mode={editor}
          item={item}
          onClose={() => setEditor(null)}
          onDone={(result) => {
            setEditor(null);
            if (editor === 'create') location.href = `/admin/updates/${result.slug}`;
            else {
              setMessage('De update is opgeslagen.');
              refresh();
            }
          }}
        />
      )}
    </div>
  );
}
function FeedbackStatus({
  itemId,
  comment,
  onDone,
}: {
  itemId: string;
  comment: UpdateComment;
  onDone: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await mutate('feedback', itemId, {
              comment_id: comment.id,
              feedback_status: comment.feedback_status === 'handling' ? 'received' : 'handling',
            });
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {comment.feedback_status === 'handling' ? 'Terug naar ontvangen' : 'In behandeling nemen'}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
function FeedbackForm({
  item,
  onDone,
  events,
}: {
  item: PlatformUpdate;
  onDone: (notification?: string) => void;
  events: UpdateEvent[];
}) {
  const [body, setBody] = useState(''),
    [reply, setReply] = useState<UpdateComment | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [eventId, setEventId] = useState('');
  const token = useRef('');
  const locked = useRef(false);
  useEffect(() => {
    if (!body.trim()) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [body]);
  useEffect(() => {
    const listener = (e: Event) => {
      setReply((e as CustomEvent).detail);
      setEventId('');
      token.current = '';
    };
    document.addEventListener('update-reply', listener);
    return () => document.removeEventListener('update-reply', listener);
  }, []);
  return (
    <form
      className="up-feedback-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError('');
        token.current ||= crypto.randomUUID();
        try {
          const result = await mutate('comment', item.id, {
            body: body.trim(),
            reply_to: reply?.id || '',
            event_id: reply ? eventId : '',
            token: token.current,
          });
          setBody('');
          setReply(null);
          setEventId('');
          token.current = '';
          onDone(result.notification);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
      aria-busy={busy}
    >
      <label htmlFor="feedback-body">
        {reply ? `Antwoord aan ${reply.author_name}` : 'Jouw vraag of opmerking'}
      </label>
      {reply && (
        <div className="up-reply-context">
          <p>{reply.body}</p>
          <button type="button" onClick={() => setReply(null)}>
            Antwoord annuleren
          </button>
        </div>
      )}
      <textarea
        id="feedback-body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          token.current = '';
        }}
        required
        maxLength={4000}
        rows={4}
        placeholder="Vertel gerust wat je ervan vindt…"
        disabled={busy}
      />
      {reply && (
        <label className="up-link-event">
          Verwerkt in een mijlpaal (optioneel)
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Geen koppeling</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="up-form-bottom">
        <span>{body.length.toLocaleString('nl-BE')} / 4.000</span>
        <button className="up-button" disabled={busy || !body.trim()}>
          {busy ? 'Wordt opgeslagen…' : reply ? 'Antwoord plaatsen' : 'Feedback versturen'}
          <Arrow />
        </button>
      </div>
      {error && (
        <p className="up-error" role="alert">
          {error}
        </p>
      )}
      <p className="up-form-note">
        Je reactie blijft bij deze update. Deel hier geen cliëntgegevens.
      </p>
    </form>
  );
}
function UpdateEditor({
  mode,
  item,
  onClose,
  onDone,
}: {
  mode: 'create' | 'edit' | 'event';
  item?: PlatformUpdate;
  onClose: () => void;
  onDone: (data: any) => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (dirty.current) setClosing(true);
    else onClose();
  };
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="up-editor"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else {
          e.preventDefault();
          close();
        }
      }}
    >
      <form
        onChange={() => {
          dirty.current = true;
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const f = new FormData(e.currentTarget),
            values = Object.fromEntries(f);
          setBusy(true);
          setError('');
          try {
            await mutate(mode, item?.id, {
              ...values,
              revision: item?.revision,
              published: f.get('published') === 'on',
              notify: f.get('notify') === 'on',
            });
            onDone(values);
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <header>
          <h2>
            {mode === 'create'
              ? 'Een nieuwe verbetering'
              : mode === 'event'
                ? 'Een volgende stap'
                : 'Update bewerken'}
          </h2>
          <button type="button" onClick={close} disabled={busy}>
            Sluiten
          </button>
        </header>
        <p>
          {mode === 'event'
            ? 'Deze mijlpaal verschijnt in de tijdlijn en maakt de update opnieuw nieuw.'
            : 'Schrijf zoals je het aan Virginie zou uitleggen.'}
        </p>
        <fieldset disabled={busy}>
          <label>
            Titel
            <input
              name="title"
              required
              minLength={3}
              maxLength={160}
              defaultValue={mode === 'edit' ? item?.title : ''}
            />
          </label>
          {mode === 'create' && (
            <label>
              Linknaam
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={120}
                placeholder="bijvoorbeeld: afspraken-makkelijker-terugvinden"
              />
              <small>Kleine letters en streepjes; deze link blijft bestaan.</small>
            </label>
          )}
          {mode !== 'event' && (
            <label>
              In één zin
              <textarea
                name="summary"
                required
                minLength={3}
                maxLength={350}
                rows={2}
                defaultValue={item?.summary}
              />
            </label>
          )}
          <label>
            {mode === 'event' ? 'Wat is er gebeurd?' : 'Wat verandert er voor Virginie?'}
            <textarea
              name="body"
              required
              minLength={3}
              maxLength={mode === 'event' ? 4000 : 12000}
              rows={5}
              defaultValue={mode === 'edit' ? item?.body : ''}
            />
          </label>
          {mode !== 'edit' && (
            <label>
              Status
              <select name="status" defaultValue={item?.status || 'planned'}>
                {Object.entries(UPDATE_STATES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Volgende stap
            <textarea
              name="next_step"
              maxLength={1200}
              rows={2}
              defaultValue={item?.next_step || ''}
            />
          </label>
          {mode !== 'event' && (
            <>
              <label>
                Onderdeel
                <select name="category" defaultValue={item?.category || 'Werkruimte'}>
                  {UPDATE_CATEGORIES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Omgeving
                <select name="audience" defaultValue={item?.audience || 'dashboard'}>
                  <option value="dashboard">Dashboard</option>
                  <option value="website">Website</option>
                </select>
              </label>
              <div className="up-editor-link-fields">
                <label>
                  Knoptekst
                  <input
                    name="action_label"
                    maxLength={80}
                    defaultValue={item?.action_label || ''}
                  />
                </label>
                <label>
                  Interne link
                  <input
                    name="action_path"
                    maxLength={200}
                    defaultValue={item?.action_path || ''}
                    placeholder="/admin/agenda"
                  />
                </label>
              </div>
              <label className="up-check">
                <input type="checkbox" name="published" defaultChecked={item?.published} />{' '}
                Publiceren voor lezers
              </label>
              {mode === 'edit' && (
                <label className="up-check">
                  <input type="checkbox" name="notify" /> Inhoudelijke wijziging: opnieuw als nieuw
                  tonen
                </label>
              )}
            </>
          )}
          {((mode === 'event' && item?.status === 'released') ||
            mode === 'create' ||
            mode === 'event') && (
            <p className="up-form-note">
              Kies ‘Beschikbaar’ pas nadat je de functie op de live website hebt gecontroleerd.
            </p>
          )}
        </fieldset>
        {closing && (
          <div className="up-close-choice" role="status">
            <p>Je wijzigingen zijn nog niet opgeslagen.</p>
            <button type="button" onClick={() => setClosing(false)}>
              Verder schrijven
            </button>
            <button type="button" onClick={onClose}>
              Wijzigingen verwerpen
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="up-error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={close} disabled={busy}>
            Annuleren
          </button>
          <button className="up-button" disabled={busy}>
            {busy
              ? 'Wordt opgeslagen…'
              : mode === 'event'
                ? 'Mijlpaal toevoegen'
                : 'Update opslaan'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
