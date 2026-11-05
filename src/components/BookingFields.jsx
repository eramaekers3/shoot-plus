// The pieces both booking sheets are built from: picking a service, a date, a client, how it was
// paid, and the expenses.
import { useMemo, useState } from 'react';
import { addDays, fmt, todayISO } from '../lib/dates.js';
import { norm } from '../lib/text.js';
import { newId } from '../lib/ids.js';
import { EXPENSE_CATS, money, num, clientFor } from '../lib/biz.js';
import { Icon } from './ui.jsx';

/** The price a service and package come to (hourly services multiply by hours). */
export function priceFor(s, pkgName, hours) {
  if (!s) return null;
  const p = (s.packages || []).find((x) => x.name === pkgName);
  if (p) return num(p.price);
  if (s.unit === 'hour') return num(s.price) * Math.max(num(hours) || num(s.hours) || 1, num(s.hours));
  return num(s.price);
}

export function ServicePick({ biz, value, onPick }) {
  if (!biz.services.length) return <p className="muted small">Add services on the Pricing page to pick from them here.</p>;
  return (
    <div className="chips">
      {biz.services.map((s) => (
        <button key={s.id} type="button" className="chip cat-chip" style={{ '--c': s.color }} aria-pressed={value === s.id} onClick={() => onPick(value === s.id ? '' : s.id)}>
          <i />{s.name}
        </button>
      ))}
    </div>
  );
}

export function PackagePick({ s, value, onPick }) {
  if (!s || !(s.packages || []).length) return null;
  return (
    <div className="chips pkg-chips">
      {s.packages.map((p) => (
        <button key={p.id} type="button" className="chip" aria-pressed={value === p.name} onClick={() => onPick(value === p.name ? null : p)}>
          {p.name} <span className="muted">{money(p.price)}</span>
        </button>
      ))}
    </div>
  );
}

export function DatePick({ value, onChange }) {
  const t = todayISO();
  const quick = [
    [addDays(t, -2), fmt(addDays(t, -2), { weekday: 'short' })],
    [addDays(t, -1), 'Yesterday'],
    [t, 'Today'],
    [addDays(t, 1), 'Tomorrow'],
  ];
  const custom = !quick.some(([d]) => d === value);
  return (
    <>
      <div className="date-grid">
        {quick.map(([d, label]) => (
          <button key={d} type="button" className="date-chip" aria-pressed={value === d} onClick={() => onChange(d)}>
            <b>{label}</b>
            <span>{fmt(d, { month: 'short', day: 'numeric' })}</span>
          </button>
        ))}
      </div>
      <label className="f date-other">
        {custom ? 'Date' : 'Another day'}
        <input className="input" type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
    </>
  );
}

export function PlaceInput({ biz, value, onChange }) {
  const recent = useMemo(() => {
    const seen = [];
    for (const b of biz.all) {
      const l = (b.location || '').trim();
      if (l && !seen.some((x) => norm(x) === norm(l))) seen.push(l);
      if (seen.length >= 6) break;
    }
    return seen;
  }, [biz]);
  return (
    <>
      <input className="input" placeholder="Park, studio, venue…" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      {recent.length > 0 && (
        <div className="chips again-chips" data-noswipe>
          {recent.filter((l) => norm(l) !== norm(value)).map((l) => (
            <button key={l} type="button" className="chip again" onClick={() => onChange(l)}>{l}</button>
          ))}
        </div>
      )}
    </>
  );
}

/** Type a name: pick an existing client or add a new one. */
export function ClientPick({ biz, value, onChange, autoFocus }) {
  const current = value && biz.clientById[value];
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(!current);
  const matches = useMemo(() => {
    const n = norm(q);
    const list = n ? biz.clients.filter((c) => norm(c.name).includes(n)) : recentClients(biz);
    return list.slice(0, 6);
  }, [biz, q]);
  if (current && !editing) {
    return (
      <div className="client-picked">
        <span className="avatar sm" aria-hidden="true"><Icon name="user" size={15} /></span>
        <b>{current.name}</b>
        <button type="button" className="mini" onClick={() => { setQ(''); setEditing(true); }}>Change</button>
        <button type="button" className="x" aria-label="No client" onClick={() => onChange('')}>×</button>
      </div>
    );
  }
  const exact = biz.clients.some((c) => norm(c.name) === norm(q));
  return (
    <div className="client-pick">
      <input className="input" placeholder="Client name" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) {
            e.preventDefault();
            onChange(clientFor(biz, q));
            setEditing(false);
          }
        }}
      />
      <div className="chips">
        {matches.map((c) => (
          <button key={c.id} type="button" className="chip" onClick={() => { onChange(c.id); setEditing(false); }}>{c.name}</button>
        ))}
        {q.trim() && !exact && (
          <button type="button" className="chip add-chip" onClick={() => { onChange(clientFor(biz, q)); setEditing(false); }}>
            <Icon name="plus" size={14} /> Add “{q.trim()}”
          </button>
        )}
      </div>
    </div>
  );
}

function recentClients(biz) {
  const out = [];
  for (const b of biz.all) {
    const c = b.clientId && biz.clientById[b.clientId];
    if (c && !out.includes(c)) out.push(c);
    if (out.length >= 6) break;
  }
  return out;
}

export function MethodPick({ methods, value, onChange }) {
  return (
    <div className="chips">
      {methods.map((m) => (
        <button key={m} type="button" className="chip" aria-pressed={value === m} onClick={() => onChange(value === m ? '' : m)}>{m}</button>
      ))}
    </div>
  );
}

/** A list of expenses: what kind, a label and an amount. */
export function ExpenseList({ value = [], onChange }) {
  const set = (id, k, v) => onChange(value.map((e) => (e.id === id ? { ...e, [k]: v } : e)));
  const add = (cat) => onChange([...value, { id: newId(), cat: cat.id, label: cat.name, amount: '' }]);
  return (
    <div className="exp-list">
      {value.map((e) => (
        <div className="item-line exp-line" key={e.id}>
          <select className="input exp-cat" value={e.cat} onChange={(ev) => set(e.id, 'cat', ev.target.value)} aria-label="Kind">
            {EXPENSE_CATS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input" placeholder="What for" value={e.label} onChange={(ev) => set(e.id, 'label', ev.target.value)} />
          <input className="input num-in" inputMode="decimal" placeholder="$" value={e.amount} onChange={(ev) => set(e.id, 'amount', ev.target.value)} onBlur={() => set(e.id, 'amount', num(e.amount))} />
          <button type="button" className="x" aria-label="Remove expense" onClick={() => onChange(value.filter((x) => x.id !== e.id))}>×</button>
        </div>
      ))}
      <div className="chips">
        {EXPENSE_CATS.slice(0, 4).map((c) => (
          <button key={c.id} type="button" className="chip add-chip" onClick={() => add(c)}><Icon name="plus" size={13} /> {c.name}</button>
        ))}
        <button type="button" className="chip add-chip" onClick={() => add(EXPENSE_CATS.at(-1))}><Icon name="plus" size={13} /> Other</button>
      </div>
    </div>
  );
}

/** Price, minus expenses, minus tax: what the booking actually leaves you. */
export function MoneySummary({ $, s }) {
  return (
    <div className="m-sum">
      <div><span>Income</span><b>{money($.gross)}</b></div>
      <div className="minus"><span>Expenses</span><b>{money($.costs)}</b></div>
      <div className="minus"><span>Tax ({s.taxRate}%)</span><b>{money($.tax)}</b></div>
      <div className="keep"><span>You keep</span><b>{money($.keep)}</b></div>
    </div>
  );
}

export const MoneyIn = ({ value, onChange, placeholder = '0', autoFocus, label }) => (
  <span className="money-in">
    <span aria-hidden="true">$</span>
    <input className="input" inputMode="decimal" placeholder={placeholder} value={value ?? ''} aria-label={label}
      onChange={(e) => onChange(e.target.value)} onBlur={() => value !== '' && value != null && onChange(num(value))} autoFocus={autoFocus} />
  </span>
);
