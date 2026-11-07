import { useState } from 'react';
import { put, useRecord } from '../store.js';
import { todayISO, fmt } from '../lib/dates.js';
import { OVERHEAD_CATS, num, money, perYear, occurrences, useBiz, removeWithUndo } from '../lib/biz.js';
import { closeSheet } from '../lib/open.js';
import { toast } from '../lib/toast.js';
import { haptic } from '../lib/haptics.js';
import { Sheet } from './ui.jsx';
import { MoneyIn } from './BookingFields.jsx';

const REPEATS = [
  { id: '', label: 'Once' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

/** A business expense: gear, software, insurance… New ones save with the button; existing ones save as you type. */
export default function ExpenseSheet({ id, onClose }) {
  const biz = useBiz();
  const saved = useRecord(id);
  const [draft, setDraft] = useState({ date: todayISO(), cat: 'gear', label: '', amount: '', repeat: '', until: '', notes: '' });
  const [confirm, setConfirm] = useState(false);
  const isNew = !id;
  const e = isNew ? draft : saved;
  if (!e) return null;
  const set = (k, v) => (isNew ? setDraft({ ...draft, [k]: v }) : put('expense', { ...saved, [k]: v }));
  const paidSoFar = isNew ? 0 : occurrences({ ...biz, expenses: [e] }).reduce((t, o) => t + num(o.amount), 0);

  return (
    <Sheet title={isNew ? 'New expense' : e.label || 'Expense'} onClose={onClose}>
      <div className="form-grid">
        <label className="f full">
          What for
          <input className="input" placeholder="Sigma 70-200, Lightroom, insurance…" value={e.label} onChange={(ev) => set('label', ev.target.value)} autoFocus={isNew} />
        </label>
        <label className="f">
          Amount
          <MoneyIn value={e.amount} onChange={(v) => set('amount', v)} />
        </label>
        <label className="f">
          {e.repeat ? 'Starting' : 'Date'}
          <input className="input" type="date" value={e.date} onChange={(ev) => ev.target.value && set('date', ev.target.value)} />
        </label>
        <div className="f full">
          Kind
          <div className="chips">
            {OVERHEAD_CATS.map((c) => (
              <button key={c.id} type="button" className="chip cat-chip" style={{ '--c': c.c }} aria-pressed={e.cat === c.id} onClick={() => set('cat', c.id)}>
                <i />{c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="f full">
          Repeats
          <div className="seg" role="group" aria-label="Repeats">
            {REPEATS.map((r) => <button key={r.id} type="button" aria-pressed={(e.repeat || '') === r.id} onClick={() => set('repeat', r.id)}>{r.label}</button>)}
          </div>
        </div>
        {e.repeat && (
          <label className="f full">
            Stopped paying <span className="muted-n">(leave empty if you still pay it)</span>
            <input className="input" type="date" value={e.until || ''} min={e.date} onChange={(ev) => set('until', ev.target.value)} />
          </label>
        )}
        <label className="f full">
          Notes
          <textarea className="input" rows={2} placeholder="Where you bought it, receipt location…" value={e.notes || ''} onChange={(ev) => set('notes', ev.target.value)} />
        </label>
      </div>

      {e.repeat && num(e.amount) > 0 && (
        <p className="muted small">
          {money(perYear(e))} a year{!isNew && paidSoFar ? ` · ${money(paidSoFar)} paid since ${fmt(e.date, { month: 'short', year: 'numeric' })}` : ''}.
        </p>
      )}

      {isNew ? (
        <button
          className="btn wide"
          disabled={!draft.label.trim() || !num(draft.amount)}
          onClick={() => {
            put('expense', { ...draft, label: draft.label.trim(), amount: num(draft.amount), createdAt: Date.now() });
            haptic('success');
            toast(`${money(num(draft.amount))} ${draft.repeat ? `${draft.repeat} ` : ''}expense saved`);
            closeSheet();
          }}
        >
          Save expense
        </button>
      ) : (
        <div className="btn-row edit-sec">
          <button
            className={`btn ${confirm ? 'danger' : 'ghost'}`}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              removeWithUndo('expense', id, 'Expense');
              closeSheet();
            }}
          >
            {confirm ? 'Tap again to delete' : 'Delete expense'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
