import { useMemo, useState } from 'react';
import { fmt, todayISO } from '../lib/dates.js';
import { plural } from '../lib/text.js';
import { useBiz, money, occurrences, overheadCat, perYear, years, yearRange, num } from '../lib/biz.js';
import { open } from '../lib/open.js';
import { Icon } from '../components/ui.jsx';
import { SplitBar } from '../components/Charts.jsx';

/** Business expenses: what repeats (subscriptions, insurance) and everything paid, by month. */
export default function ExpensesView() {
  const biz = useBiz();
  const ys = years(biz);
  const [year, setYear] = useState(new Date().getFullYear());
  const [from, to] = yearRange(year);
  const paid = useMemo(() => occurrences(biz, from, to), [biz, from, to]);
  const total = paid.reduce((t, o) => t + num(o.amount), 0);
  const today = todayISO();
  const repeating = biz.expenses.filter((e) => e.repeat && (!e.until || e.until >= today));
  const perYearNow = repeating.reduce((t, e) => t + perYear(e), 0);

  const byCat = useMemo(() => {
    const m = new Map();
    paid.forEach((o) => m.set(o.cat, (m.get(o.cat) || 0) + num(o.amount)));
    return [...m.entries()].map(([id, v]) => ({ key: id, v, c: overheadCat(id).c, name: overheadCat(id).name })).sort((a, b) => b.v - a.v);
  }, [paid]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const o of paid) {
      const k = o.on.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(o);
    }
    return [...m.entries()];
  }, [paid]);

  return (
    <>
      <div className="chips scroll-chips" data-noswipe>
        {ys.map((y) => <button key={y} className="chip" aria-pressed={year === y} onClick={() => setYear(y)}>{y}</button>)}
        <button className="chip" aria-pressed={year === 'all'} onClick={() => setYear('all')}>All time</button>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{year === 'all' ? 'All time' : year}</h2>
          <span className="meta">{money(total)}</span>
        </div>
        {byCat.length ? (
          <>
            <SplitBar parts={byCat} />
            <div className="legend">{byCat.map((c) => <span key={c.key}><i style={{ '--c': c.c }} />{c.name} {money(c.v)}</span>)}</div>
          </>
        ) : (
          <p className="empty" style={{ marginTop: 0 }}>No business expenses yet. Add gear, software, insurance and other costs that aren’t part of one shoot; they lower your profit and your tax set-aside.</p>
        )}
        <button className="btn wide" style={{ marginTop: 12 }} onClick={() => open('expense', null)}><Icon name="plus" size={18} /> Add an expense</button>
      </section>

      {repeating.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Repeating</h2>
            <span className="meta">{money(perYearNow)}/yr</span>
          </div>
          <ul className="rows">
            {repeating.map((e) => <ExpenseRow key={e.id} e={e} sub={`${e.repeat === 'monthly' ? 'Every month' : 'Every year'} since ${fmt(e.date, { month: 'short', year: 'numeric' })}`} amount={`${money(e.amount)}/${e.repeat === 'monthly' ? 'mo' : 'yr'}`} />)}
          </ul>
        </section>
      )}

      {groups.map(([ym, items]) => (
        <section className="card month-card" key={ym}>
          <div className="card-head">
            <h2>{fmt(`${ym}-01`, { month: 'long', year: 'numeric' })}</h2>
            <span className="meta">{money(items.reduce((t, o) => t + num(o.amount), 0))}</span>
          </div>
          <ul className="rows">
            {items.map((o) => <ExpenseRow key={`${o.id}${o.on}`} e={o} on={o.on} sub={[overheadCat(o.cat).name, o.repeat ? (o.repeat === 'monthly' ? 'monthly' : 'yearly') : ''].filter(Boolean).join(' · ')} amount={money(o.amount)} />)}
          </ul>
        </section>
      ))}
      {paid.length > 0 && <p className="muted small center-text">{plural(paid.length, 'charge')} in {year === 'all' ? 'total' : year}.</p>}
    </>
  );
}

function ExpenseRow({ e, on, sub, amount }) {
  const c = overheadCat(e.cat);
  return (
    <li className="row bk-row" style={{ '--c': c.c }}>
      <button className="bk-open" onClick={() => open('expense', e.id)}>
        <span className="bk-date" aria-hidden="true">
          {on ? <><b>{fmt(on, { day: 'numeric' })}</b><span>{fmt(on, { month: 'short' })}</span></> : <Icon name={e.cat === 'software' ? 'copy' : 'tax'} size={18} />}
        </span>
        <span className="row-title bk-text">
          <span className="bk-title">{e.label || c.name}</span>
          <span className="bk-meta"><span>{sub}</span></span>
        </span>
        <span className="bk-amt"><b>{amount}</b></span>
      </button>
    </li>
  );
}
