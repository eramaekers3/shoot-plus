import { useMemo, useState } from 'react';
import { fmt } from '../lib/dates.js';
import { norm, plural } from '../lib/text.js';
import { useBiz, clientStats, money } from '../lib/biz.js';
import { openClient, open } from '../lib/open.js';
import { Icon } from '../components/ui.jsx';

const SORTS = [
  { id: 'spent', label: 'Most paid' },
  { id: 'recent', label: 'Recent' },
  { id: 'name', label: 'A–Z' },
];

export default function ClientsView() {
  const biz = useBiz();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('spent');

  const rows = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const out = biz.clients
      .filter((c) => {
        const hay = norm([c.name, c.email, c.phone, c.handle, c.notes].join(' '));
        return words.every((w) => hay.includes(w));
      })
      .map((c) => ({ c, st: clientStats(biz, c.id) }));
    if (sort === 'spent') out.sort((a, b) => b.st.gross - a.st.gross);
    if (sort === 'recent') out.sort((a, b) => (b.st.last || '').localeCompare(a.st.last || ''));
    return out;
  }, [biz, q, sort]);

  const repeat = rows.filter((r) => r.st.list.length > 1).length;

  return (
    <>
      <header className="page-head">
        <h1>Clients</h1>
        <p>{plural(biz.clients.length, 'client')}{repeat ? ` · ${repeat} came back for more` : ''}</p>
      </header>

      <div className="filters">
        <div className="search-row">
          <label className="search">
            <Icon name="search" size={18} />
            <input className="input" type="search" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="btn add-btn" onClick={() => open('client', null)} aria-label="Add a client"><Icon name="plus" size={20} /></button>
        </div>
        <div className="seg" role="group" aria-label="Sort clients">
          {SORTS.map((s) => <button key={s.id} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>)}
        </div>
      </div>

      <section className="card">
        {rows.length ? (
          <ul className="rows">
            {rows.map(({ c, st }) => (
              <li className="row cl-row" key={c.id}>
                <button className="bk-open" onClick={() => openClient(c.id)}>
                  <span className="avatar" aria-hidden="true">{initials(c.name)}</span>
                  <span className="row-title bk-text">
                    <span className="bk-title">{c.name}</span>
                    <span className="bk-meta">
                      <span>{plural(st.list.length, 'booking')}</span>
                      {st.last && <span>last {fmt(st.last, { month: 'short', year: 'numeric' })}</span>}
                      {c.handle && <span>{c.handle}</span>}
                    </span>
                  </span>
                  <span className="bk-amt"><b>{money(st.gross)}</b>{st.list.length > 1 && <span className="repeat-tag">Repeat</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty" style={{ marginTop: 0 }}>{biz.clients.length ? 'Nobody matches.' : 'Clients you add to bookings show up here.'}</p>
        )}
      </section>
    </>
  );
}

export const initials = (name = '') =>
  name
    .replace(/[^\p{L}\p{N}\s&]/gu, '')
    .split(/\s+/)
    .filter((w) => w && w !== '&')
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
