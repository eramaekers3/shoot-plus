import { useMemo, useState } from 'react';
import { fmt, todayISO } from '../lib/dates.js';
import { norm, plural } from '../lib/text.js';
import { useBiz, sum, money, years, clientName, titleOf } from '../lib/biz.js';
import BookingRow from '../components/BookingRow.jsx';
import { Icon } from '../components/ui.jsx';
import { newBooking } from '../lib/open.js';
import { useMode, setMode } from '../lib/mode.js';
import ExpensesView from './ExpensesView.jsx';

/** The Bookings tab: your bookings, or (switch at the top) business expenses. Reopens on the one you left. */
export default function BookingsView() {
  const mode = useMode();
  return (
    <>
      <header className="page-head">
        <h1>{mode === 'expenses' ? 'Expenses' : 'Bookings'}</h1>
        <div className="seg mode-seg" role="group" aria-label="Show">
          <button aria-pressed={mode !== 'expenses'} onClick={() => setMode('bookings')}>Bookings</button>
          <button aria-pressed={mode === 'expenses'} onClick={() => setMode('expenses')}>Business expenses</button>
        </div>
      </header>
      {mode === 'expenses' ? <ExpensesView key="e" /> : <BookingsList key="b" />}
    </>
  );
}

function BookingsList() {
  const biz = useBiz();
  const [q, setQ] = useState('');
  const [year, setYear] = useState('all');
  const [svc, setSvc] = useState(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const ys = years(biz);

  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return biz.all.filter((b) => {
      if (b.cancelled && !showCancelled) return false;
      if (year !== 'all' && !b.date.startsWith(String(year))) return false;
      if (svc && b.serviceId !== svc) return false;
      if (!words.length) return true;
      const hay = norm([titleOf(biz, b), clientName(biz, b.clientId), b.location, b.notes, b.method, b.date, fmt(b.date, { month: 'long' })].join(' '));
      return words.every((w) => hay.includes(w));
    });
  }, [biz, q, year, svc, showCancelled]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const b of list) {
      const k = b.date.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(b);
    }
    return [...m.entries()];
  }, [list]);

  const total = sum(list.filter((b) => !b.cancelled));
  const today = todayISO();
  const cancelledCount = biz.all.filter((b) => b.cancelled).length;

  return (
    <>
      <p className="page-sub">{plural(total.n, 'booking')} · {money(total.gross)} · {money(total.profit)} profit before business expenses</p>

      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <input className="input" type="search" placeholder="Search clients, places, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips scroll-chips" data-noswipe>
          <button className="chip" aria-pressed={year === 'all'} onClick={() => setYear('all')}>All time</button>
          {ys.map((y) => <button key={y} className="chip" aria-pressed={year === y} onClick={() => setYear(y)}>{y}</button>)}
        </div>
        <div className="chips scroll-chips" data-noswipe>
          {biz.services.map((s) => (
            <button key={s.id} className="chip cat-chip" style={{ '--c': s.color }} aria-pressed={svc === s.id} onClick={() => setSvc(svc === s.id ? null : s.id)}>
              <i />{s.name}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <section className="card">
          <p className="empty" style={{ marginTop: 0 }}>{biz.all.length ? 'Nothing matches.' : 'No bookings yet.'}</p>
          <button className="btn wide" onClick={() => newBooking()}>Add a booking</button>
        </section>
      ) : (
        groups.map(([ym, items]) => {
          const t = sum(items.filter((b) => !b.cancelled));
          const future = `${ym}-31` > today && ym > today.slice(0, 7);
          return (
            <section className="card month-card" key={ym}>
              <div className="card-head">
                <h2>{fmt(`${ym}-01`, { month: 'long', year: 'numeric' })}{future && <span className="tag-soon">Upcoming</span>}</h2>
                <span className="meta">{money(t.gross)}{t.costs > 0 && <span className="muted"> · {money(t.profit)} profit</span>}</span>
              </div>
              <ul className="rows">{items.map((b) => <BookingRow key={b.id} biz={biz} b={b} />)}</ul>
            </section>
          );
        })
      )}

      {cancelledCount > 0 && (
        <button className="link-btn center-link" onClick={() => setShowCancelled(!showCancelled)}>
          {showCancelled ? 'Hide' : 'Show'} {plural(cancelledCount, 'cancelled booking')}
        </button>
      )}
    </>
  );
}
