import { useMemo, useState } from 'react';
import { fmt, todayISO, parse, addDays } from '../lib/dates.js';
import { plural } from '../lib/text.js';
import { put } from '../store.js';
import {
  useBiz, sum, inYear, done, cumulative, groupBy, expensesByCat, taxYear, years, money, num,
  totals, monthsFull, overheadByCat, yearRange, avgTurnaround,
  clientName, thisYear, removeWithUndo, titleOf,
} from '../lib/biz.js';
import { openBooking, openClient, goTab } from '../lib/open.js';
import { setMode } from '../lib/mode.js';
import { toast } from '../lib/toast.js';
import CardStack from '../components/CardStack.jsx';
import BookingRow from '../components/BookingRow.jsx';
import { MonthBars, CumLine, SplitBar, BarRows, WeekdayBars } from '../components/Charts.jsx';
import { CountUp, Icon } from '../components/ui.jsx';

export default function StatsView() {
  const biz = useBiz();
  const ys = years(biz);
  const [y, setY] = useState(thisYear());
  const today = todayISO();
  const list = useMemo(() => done(inYear(biz.live, y)), [biz, y]);
  const t = useMemo(() => {
    const [from, to] = yearRange(y);
    return totals(biz, list, from, to);
  }, [biz, list, y]);

  // The same stretch of last year, for a fair comparison (Jan 1 → today's date).
  const prevSame = useMemo(() => {
    if (y === 'all') return null;
    const cut = `${y - 1}${today.slice(4)}`;
    const prev = inYear(biz.live, y - 1).filter((b) => (y === thisYear() ? b.date <= cut : true));
    return prev.length ? sum(prev) : null;
  }, [biz, y, today]);

  const idx = ys.indexOf(y);
  return (
    <>
      <header className="page-head">
        <h1>Stats</h1>
        <div className="year-pick">
          <button className="icon-btn" aria-label="Earlier year" disabled={y === 'all' || idx === ys.length - 1} onClick={() => setY(ys[idx + 1])}><Icon name="left" /></button>
          <div className="seg" role="group" aria-label="Year">
            <button aria-pressed={y !== 'all'} onClick={() => y === 'all' && setY(thisYear())}>{y === 'all' ? thisYear() : y}</button>
            <button aria-pressed={y === 'all'} onClick={() => setY('all')}>All time</button>
          </div>
          <button className="icon-btn" aria-label="Later year" disabled={y === 'all' || idx <= 0} onClick={() => setY(ys[idx - 1])}><Icon name="right" /></button>
        </div>
      </header>

      <CardStack
        page="stats"
        cards={[
          { id: 'overview', title: 'Overview', node: <Overview t={t} prev={prevSame} y={y} /> },
          { id: 'months', title: y === 'all' ? 'By year' : 'By month', node: <Months biz={biz} y={y} /> },
          { id: 'pace', title: 'Compared with last year', node: y === 'all' ? null : <Pace biz={biz} y={y} /> },
          { id: 'services', title: 'By service', node: <Services biz={biz} list={list} /> },
          { id: 'clients', title: 'Clients', node: <Clients biz={biz} list={list} y={y} /> },
          { id: 'expenses', title: 'Expenses', node: <Expenses biz={biz} list={list} t={t} y={y} /> },
          { id: 'when', title: 'When & where', node: <WhenWhere list={list} /> },
          { id: 'paid', title: 'Paid with', node: <PaidWith list={list} /> },
          { id: 'tax', title: 'Taxes', node: <Taxes biz={biz} y={y === 'all' ? thisYear() : y} /> },
          { id: 'records', title: 'Records', node: <Records biz={biz} /> },
        ]}
      />
    </>
  );
}

/* ---------- Overview ---------- */

function Overview({ t, prev, y }) {
  const change = prev && prev.gross ? (t.gross - prev.gross) / prev.gross : null;
  const margin = t.gross ? t.profit / t.gross : 0;
  return (
    <section className="card" aria-labelledby="ov-h">
      <div className="card-head">
        <h2 id="ov-h">{y === 'all' ? 'All time' : y === thisYear() ? `${y} so far` : y}</h2>
        <span className="meta">{plural(t.n, 'booking')}</span>
      </div>
      <div className="hero-row">
        <div>
          <div className="label">Income</div>
          <div className="big money-big"><CountUp value={t.gross} format={money} /></div>
        </div>
        {change !== null && (
          <div className="right">
            <div className="label">vs {y - 1}{y === thisYear() ? ' by now' : ''}</div>
            <div className={`delta ${change >= 0 ? 'pos' : 'neg'}`}>{change >= 0 ? '+' : '−'}{Math.abs(Math.round(change * 100))}%</div>
          </div>
        )}
      </div>
      <div className="tiles tiles-3">
        <div className="tile"><span>Profit</span><b>{money(t.profit)}</b></div>
        <div className="tile"><span>All expenses</span><b>{money(t.allCosts)}</b></div>
        <div className="tile"><span>After tax</span><b className="pos">{money(t.keep)}</b></div>
        <div className="tile"><span>Avg booking</span><b>{money(Math.round(t.avg))}</b></div>
        <div className="tile"><span>Per hour shooting</span><b>{t.hours ? money(Math.round(t.gross / t.hours)) : '—'}</b></div>
        <div className="tile"><span>Kept of each $1</span><b>{Math.round(margin * 100)}¢</b></div>
      </div>
      {t.tip > 0 && <p className="muted small">Includes {money(t.tip)} in tips. {t.hours ? `${Math.round(t.hours)} hours behind the camera.` : ''}</p>}
    </section>
  );
}

/* ---------- By month ---------- */

function Months({ biz, y }) {
  const [picked, setPicked] = useState(null);
  const today = todayISO();
  const data = useMemo(() => {
    if (y === 'all') {
      return years(biz).slice().reverse().map((yr) => ({ ym: String(yr), label: `’${String(yr).slice(2)}`, ...totals(biz, done(inYear(biz.live, yr)), ...yearRange(yr)) }));
    }
    return monthsFull(biz, y);
  }, [biz, y]);
  const p = data.find((m) => m.ym === picked);
  const pickedList = p ? biz.live.filter((b) => b.date.startsWith(p.ym)) : [];
  const best = data.reduce((a, m) => (m.gross > (a ? a.gross : 0) ? m : a), null);
  const label = (ym) => (ym.length === 4 ? ym : fmt(`${ym}-01`, { month: 'long' }));
  return (
    <section className="card" aria-labelledby="mo-h">
      <div className="card-head">
        <h2 id="mo-h">{y === 'all' ? 'By year' : 'By month'}</h2>
        {best && best.gross > 0 && <span className="meta">Best: {label(best.ym)}</span>}
      </div>
      <MonthBars months={data} picked={picked} onPick={setPicked} current={y === 'all' ? today.slice(0, 4) : today.slice(0, 7)} />
      <div className="legend">
        <span><i style={{ '--c': 'var(--sun)' }} />Profit</span>
        <span><i style={{ '--c': 'color-mix(in srgb, var(--coral) 45%, var(--raised))' }} />Expenses</span>
        <span className="muted">Tap a bar for details</span>
      </div>
      {p && (
        <div className="picked" key={p.ym}>
          <div className="picked-head">
            <b>{label(p.ym)}</b>
            <span className="meta">{plural(p.n, 'booking')}</span>
          </div>
          <div className="tiles tiles-3">
            <div className="tile"><span>Income</span><b>{money(p.gross)}</b></div>
            <div className="tile"><span>Profit</span><b>{money(p.profit)}</b></div>
            <div className="tile"><span>Tax set aside</span><b>{money(p.tax)}</b></div>
          </div>
          {p.ym.length === 7 && pickedList.length > 0 && <ul className="rows">{pickedList.map((b) => <BookingRow key={b.id} biz={biz} b={b} />)}</ul>}
        </div>
      )}
    </section>
  );
}

/* ---------- Pace vs last year ---------- */

function Pace({ biz, y }) {
  const today = todayISO();
  const isNow = y === thisYear();
  const cur = cumulative(biz.live, y, isNow ? today : '9999');
  const prev = cumulative(biz.live, y - 1);
  const todayDay = isNow ? Math.round((parse(today) - parse(`${y}-01-01`)) / 864e5) : 365;
  const prevByNow = prev.filter((p) => p.d <= todayDay).at(-1);
  const ahead = cur.at(-1).v - (prevByNow ? prevByNow.v : 0);
  return (
    <section className="card" aria-labelledby="pace-h">
      <div className="card-head">
        <h2 id="pace-h">Compared with {y - 1}</h2>
        {prev.length > 1 && <span className={`meta ${ahead >= 0 ? 'pos' : 'neg'}`}>{ahead >= 0 ? `${money(ahead)} ahead` : `${money(-ahead)} behind`}</span>}
      </div>
      <CumLine cur={cur} prev={prev} todayDay={todayDay} />
      <div className="legend">
        <span><i style={{ '--c': 'var(--sun)' }} />{y}</span>
        {prev.length > 1 && <span><i style={{ '--c': 'var(--muted)' }} />{y - 1}</span>}
      </div>
    </section>
  );
}

/* ---------- Services ---------- */

function Services({ biz, list }) {
  const groups = groupBy(list, (b) => b.serviceId || 'none');
  const rows = groups.map((g) => {
    const s = biz.serviceById[g.key];
    return { key: g.key, label: s ? s.name : 'No service', c: s ? s.color : 'var(--dim)', v: g.gross, sub: ` · ${g.n}`, avg: g.avg, hours: g.hours, profit: g.profit };
  });
  if (!rows.length) return <Empty id="sv" title="By service" />;
  const best = [...rows].filter((r) => r.hours).sort((a, b) => b.v / b.hours - a.v / a.hours)[0];
  return (
    <section className="card" aria-labelledby="sv-h">
      <div className="card-head"><h2 id="sv-h">By service</h2><span className="meta">income · bookings</span></div>
      <SplitBar parts={rows.map((r) => ({ key: r.key, v: r.v, c: r.c }))} />
      <BarRows rows={rows} format={money} />
      {best && <p className="muted small">Best paying per hour: <b className="ink">{best.label}</b> at about {money(Math.round(best.v / best.hours))}/hr.</p>}
    </section>
  );
}

/* ---------- Clients ---------- */

function Clients({ biz, list, y }) {
  const groups = groupBy(list, (b) => b.clientId || null);
  if (!groups.length) return <Empty id="cl" title="Clients" />;
  // Repeat clients: booked more than once, ever.
  const everCount = new Map();
  biz.live.forEach((b) => b.clientId && everCount.set(b.clientId, (everCount.get(b.clientId) || 0) + 1));
  const repeat = groups.filter((g) => everCount.get(g.key) > 1);
  const repeatShare = repeat.reduce((t, g) => t + g.gross, 0) / (groups.reduce((t, g) => t + g.gross, 0) || 1);
  const firstSeen = new Map();
  [...biz.live].reverse().forEach((b) => b.clientId && !firstSeen.has(b.clientId) && firstSeen.set(b.clientId, b.date));
  const fresh = y === 'all' ? groups.length : groups.filter((g) => (firstSeen.get(g.key) || '').startsWith(String(y))).length;
  return (
    <section className="card" aria-labelledby="cl-h">
      <div className="card-head"><h2 id="cl-h">Clients</h2><span className="meta">{plural(groups.length, 'client')}</span></div>
      <div className="tiles tiles-3">
        <div className="tile"><span>{y === 'all' ? 'Clients' : 'New clients'}</span><b>{fresh}</b></div>
        <div className="tile"><span>Came back</span><b>{repeat.length}</b></div>
        <div className="tile"><span>From repeat clients</span><b>{Math.round(repeatShare * 100)}%</b></div>
      </div>
      <h3 className="sub-h">Top clients</h3>
      <BarRows
        rows={groups.slice(0, 6).map((g) => ({ key: g.key, label: clientName(biz, g.key) || 'Unknown', v: g.gross, sub: ` · ${g.n}` }))}
        format={money}
        onPick={(r) => openClient(r.key)}
      />
    </section>
  );
}

/* ---------- Expenses ---------- */

function Expenses({ biz, list, t, y }) {
  const shoot = expensesByCat(list);
  const biz2 = overheadByCat(biz, ...yearRange(y));
  const rows = [
    ...biz2.map((c) => ({ key: `o-${c.id}`, label: c.name, c: c.c, v: c.v })),
    ...shoot.map((c) => ({ key: `s-${c.id}`, label: c.name, c: c.c, v: c.v })),
  ].sort((a, b) => b.v - a.v);
  const s = biz.s;
  return (
    <section className="card" aria-labelledby="ex-h">
      <div className="card-head"><h2 id="ex-h">Expenses</h2><span className="meta">{money(t.allCosts)}</span></div>
      {rows.length ? (
        <>
          <div className="tiles tiles-3">
            <div className="tile"><span>Business</span><b>{money(t.overhead)}</b></div>
            <div className="tile"><span>On shoots</span><b>{money(t.costs)}</b></div>
            <div className="tile"><span>Of income</span><b>{t.gross ? Math.round((t.allCosts / t.gross) * 100) : 0}%</b></div>
          </div>
          <SplitBar parts={rows.map((r) => ({ key: r.key, v: r.v, c: r.c }))} />
          <BarRows rows={rows} format={money} />
          <p className="muted small">
            Business expenses are gear, software and other costs not tied to one shoot. {t.miles ? `${Math.round(t.miles)} miles driven, counted at ${money(s.mileRate)}/mile.` : ''}
          </p>
        </>
      ) : (
        <p className="empty">No expenses logged. Add gear and software as business expenses, and rentals or miles on each booking.</p>
      )}
      <button className="link-btn" onClick={() => { setMode('expenses'); goTab('bookings'); }}>Business expenses →</button>
    </section>
  );
}

/* ---------- When and where ---------- */

function WhenWhere({ list }) {
  if (!list.length) return <Empty id="ww" title="When & where" />;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  list.forEach((b) => counts[(parse(b.date).getDay() + 6) % 7]++);
  const places = groupBy(list, (b) => (b.location || '').trim() || null).slice(0, 5);
  const hours = groupBy(list.filter((b) => b.time), (b) => {
    const h = +b.time.slice(0, 2);
    return h < 12 ? 'Morning' : h < 16 ? 'Afternoon' : 'Evening';
  });
  return (
    <section className="card" aria-labelledby="ww-h">
      <div className="card-head"><h2 id="ww-h">When & where</h2></div>
      <WeekdayBars counts={counts} />
      {hours.length > 0 && (
        <p className="muted small">
          Most shoots are in the <b className="ink">{hours.sort((a, b) => b.n - a.n)[0].key.toLowerCase()}</b>
          {' '}({hours.map((h) => `${h.key.toLowerCase()} ${h.n}`).join(', ')}).
        </p>
      )}
      {places.length > 0 && (
        <>
          <h3 className="sub-h">Top locations</h3>
          <BarRows rows={places.map((p) => ({ key: p.key, label: p.key, v: p.n, sub: ` · ${money(p.gross)}` }))} format={(v) => plural(v, 'shoot')} />
        </>
      )}
    </section>
  );
}

/* ---------- Payment methods ---------- */

const METHOD_COLORS = ['#7cc4ff', '#7fdca0', '#ffcf5c', '#bba9ff', '#ff86b8', '#ff9f4a', '#b6b4ad'];
function PaidWith({ list }) {
  const groups = groupBy(list, (b) => b.method || 'Not noted');
  if (!groups.length) return <Empty id="pw" title="Paid with" />;
  const rows = groups.map((g, i) => ({ key: g.key, label: g.key, c: METHOD_COLORS[i % METHOD_COLORS.length], v: g.gross, sub: ` · ${g.n}` }));
  return (
    <section className="card" aria-labelledby="pw-h">
      <div className="card-head"><h2 id="pw-h">Paid with</h2></div>
      <SplitBar parts={rows.map((r) => ({ key: r.key, v: r.v, c: r.c }))} />
      <BarRows rows={rows} format={money} />
    </section>
  );
}

/* ---------- Taxes ---------- */

function Taxes({ biz, y }) {
  const tax = taxYear(biz, y);
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [forYear, setForYear] = useState(String(y));
  const pays = biz.taxpays.filter((p) => +(p.forYear || p.date.slice(0, 4)) === +y);
  const add = (e) => {
    e.preventDefault();
    const a = num(amount);
    if (!a) return;
    put('taxpay', { date, amount: a, forYear: +forYear, note: '' });
    setAmount('');
    toast(`${money(a)} tax payment saved`);
  };
  return (
    <section className="card" aria-labelledby="tx-h">
      <div className="card-head"><h2 id="tx-h">Taxes · {y}</h2><span className="meta">{biz.s.taxRate}% of profit</span></div>
      <div className="tax-line">
        <div><span>Set aside</span><b>{money(tax.setAside)}</b></div>
        <div><span>Paid</span><b>{money(tax.paid)}</b></div>
        <div className={tax.owed > 0 ? 'owe' : ''}><span>Still to pay</span><b>{money(tax.owed)}</b></div>
      </div>
      <ul className="q-list">
        {tax.quarters.map((q) => (
          <li key={q.q} className={q.due < today ? 'past' : tax.next && tax.next.q === q.q ? 'next' : ''}>
            <b>Q{q.q}</b>
            <span>{fmt(q.from, { month: 'short' })}–{fmt(q.to, { month: 'short' })}</span>
            <span className="muted">due {fmt(q.due, { month: 'short', day: 'numeric' })}</span>
            <b className="q-amt">{money(q.tax)}</b>
          </li>
        ))}
      </ul>
      <h3 className="sub-h">Payments sent</h3>
      {pays.length ? (
        <ul className="rows">
          {pays.map((p) => (
            <li className="row" key={p.id}>
              <span className="row-title">{money(p.amount)} <span className="muted small">· {fmt(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></span>
              <button className="x" aria-label="Delete payment" onClick={() => removeWithUndo('taxpay', p.id, 'Tax payment')}>×</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty" style={{ marginTop: 0 }}>None yet for {y}.</p>
      )}
      <form className="inline tax-form" onSubmit={add}>
        <input className="input num-in" inputMode="decimal" placeholder="$ amount" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount paid" />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date paid" />
        <select className="input year-sel" value={forYear} onChange={(e) => setForYear(e.target.value)} aria-label="For tax year">
          {[y + 1, y, y - 1].map((v) => <option key={v} value={v}>for {v}</option>)}
        </select>
        <button className="btn" disabled={!num(amount)}>Add</button>
      </form>
      <p className="muted small">Set-aside is an estimate from your rate in Settings, not tax advice. Due dates are the usual US estimated-tax deadlines.</p>
    </section>
  );
}

/* ---------- Records ---------- */

function Records({ biz }) {
  const turn = avgTurnaround(biz);
  const list = done(biz.live);
  if (!list.length) return <Empty id="rc" title="Records" />;
  const biggest = [...list].sort((a, b) => b.$.gross - a.$.gross)[0];
  const months = groupBy(list, (b) => b.date.slice(0, 7));
  const bestMonth = months[0];
  const ys = groupBy(list, (b) => b.date.slice(0, 4));
  // Longest run of weeks in a row with at least one shoot.
  const weeks = new Set(list.map((b) => weekKey(b.date)));
  let run = 0, best = 0;
  const first = list.at(-1).date;
  for (let d = weekKey(first); d <= weekKey(todayISO()); d = addDays(d, 7)) {
    run = weeks.has(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return (
    <section className="card" aria-labelledby="rc-h">
      <div className="card-head"><h2 id="rc-h">Records</h2></div>
      <ul className="records">
        <li>
          <span>Biggest booking</span>
          <button className="link-btn" onClick={() => openBooking(biggest.id)}>{money(biggest.$.gross)} · {titleOf(biz, biggest)}</button>
        </li>
        <li><span>Best month</span><b>{money(bestMonth.gross)} · {fmt(`${bestMonth.key}-01`, { month: 'long', year: 'numeric' })}</b></li>
        <li><span>Best year</span><b>{money(ys[0].gross)} · {ys[0].key}</b></li>
        <li><span>Longest streak</span><b>{plural(best, 'week')} in a row with a shoot</b></li>
        {turn && <li><span>Delivery</span><b>{Math.round(turn.days * 10) / 10} days on average · {Math.round(turn.onTime * 100)}% on time ({`${turn.n} ${turn.n === 1 ? 'gallery' : 'galleries'}`})</b></li>}
        <li><span>All-time income</span><b>{money(sum(list).gross)} from {plural(list.length, 'booking')}</b></li>
      </ul>
    </section>
  );
}

function weekKey(d) {
  const x = parse(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function Empty({ id, title }) {
  return (
    <section className="card" aria-labelledby={`${id}-h`}>
      <div className="card-head"><h2 id={`${id}-h`}>{title}</h2></div>
      <p className="empty" style={{ marginTop: 0 }}>Nothing for this stretch yet.</p>
    </section>
  );
}
