import { useState } from 'react';
import { put, useRecord } from '../store.js';
import { fmt, todayISO } from '../lib/dates.js';
import { plural } from '../lib/text.js';
import { useBiz, clientStats, money, removeWithUndo, SOURCES, daysSince } from '../lib/biz.js';
import { newBooking, closeSheet } from '../lib/open.js';
import { toast } from '../lib/toast.js';
import { Sheet, Icon } from './ui.jsx';
import BookingRow from './BookingRow.jsx';

const FIELDS = [
  ['name', 'Name', 'text', 'Who is it?'],
  ['phone', 'Phone', 'tel', ''],
  ['email', 'Email', 'email', ''],
  ['handle', 'Instagram', 'text', '@'],
];

/** A client: their details (all editable), what they've paid and every booking with them. */
export default function ClientSheet({ id, onClose }) {
  const biz = useBiz();
  const saved = useRecord(id);
  const [draft, setDraft] = useState({ name: '', phone: '', email: '', handle: '', notes: '', source: '', referredBy: '' });
  const [confirm, setConfirm] = useState(false);
  const isNew = !id;
  const c = isNew ? draft : saved;
  if (!c) return null;

  const set = (k, v) => (isNew ? setDraft({ ...draft, [k]: v }) : put('client', { ...saved, [k]: v }));
  const st = isNew ? null : clientStats(biz, id);

  return (
    <Sheet title={isNew ? 'New client' : c.name || 'Client'} onClose={onClose}>
      {st && st.list.length > 0 && (
        <div className="tiles cl-tiles cl-tiles-4">
          <div className="tile"><span>Paid you</span><b>{money(st.gross)}</b></div>
          <div className="tile"><span>Bookings</span><b>{st.list.length}</b></div>
          <div className="tile"><span>Since</span><b>{fmt(st.first, { month: 'short', year: '2-digit' })}</b></div>
          <div className="tile"><span>{st.last > todayISO() ? 'Next shoot' : 'Last shoot'}</span><b>{lastLabel(st.last)}</b></div>
        </div>
      )}

      <div className="form-grid">
        {FIELDS.map(([k, label, type, ph]) => (
          <label key={k} className={`f${k === 'name' ? ' full' : ''}`}>
            {label}
            <input className="input" type={type} placeholder={ph} value={c[k] || ''} onChange={(e) => set(k, e.target.value)} autoFocus={isNew && k === 'name'} />
          </label>
        ))}
        <div className="f full">
          How they found you
          <div className="chips src-chips">
            {SOURCES.map((x) => (
              <button key={x.id} type="button" className="chip cat-chip" style={{ '--c': x.c }} aria-pressed={c.source === x.id} onClick={() => set('source', c.source === x.id ? '' : x.id)}>
                <i />{x.name}
              </button>
            ))}
          </div>
        </div>
        {c.source === 'referral' && (
          <label className="f full">
            Referred by
            <input className="input" list="cl-names" placeholder="Who sent them your way?" value={c.referredBy || ''} onChange={(e) => set('referredBy', e.target.value)} />
            <datalist id="cl-names">{biz.clients.filter((x) => x.id !== id).map((x) => <option key={x.id} value={x.name} />)}</datalist>
          </label>
        )}
        <label className="f full">
          Notes
          <textarea className="input" rows={3} placeholder="Likes golden hour, has a dog, referred by…" value={c.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>

      {!isNew && (c.phone || c.email) && (
        <div className="btn-row">
          {c.phone && <a className="mini" href={`sms:${c.phone}`}><Icon name="phone" size={14} /> Text</a>}
          {c.email && <a className="mini" href={`mailto:${c.email}`}><Icon name="mail" size={14} /> Email</a>}
        </div>
      )}

      {isNew ? (
        <button
          className="btn wide"
          disabled={!draft.name.trim()}
          onClick={() => {
            put('client', { ...draft, name: draft.name.trim(), createdAt: Date.now() });
            toast(`${draft.name.trim()} added`);
            closeSheet();
          }}
        >
          Add client
        </button>
      ) : (
        <>
          <div className="edit-sec">
            <div className="sub-head">
              <h3 className="sub-h">Bookings</h3>
              <button className="mini sun" onClick={() => newBooking({ clientId: id })}><Icon name="plus" size={14} /> New booking</button>
            </div>
            {st.list.length ? (
              <ul className="rows">{st.list.map((b) => <BookingRow key={b.id} biz={biz} b={b} showYear />)}</ul>
            ) : (
              <p className="empty">No bookings yet.</p>
            )}
            {st.list.length > 1 && <p className="muted small">Averages {money(Math.round(st.avg))} a booking across {plural(st.n, 'shoot')}.</p>}
          </div>
          <div className="btn-row edit-sec">
            <button
              className={`btn ${confirm ? 'danger' : 'ghost'}`}
              onClick={() => {
                if (!confirm) return setConfirm(true);
                removeWithUndo('client', id, 'Client');
                closeSheet();
              }}
            >
              {confirm ? 'Tap again to delete' : 'Delete client'}
            </button>
          </div>
          {confirm && <p className="muted small">Their bookings stay; they just won’t show a client name.</p>}
        </>
      )}
    </Sheet>
  );
}

const lastLabel = (d) => {
  const ago = daysSince(d);
  if (ago < 0) return fmt(d, { month: 'short', day: 'numeric' });
  if (ago < 45) return ago <= 1 ? (ago ? 'Yesterday' : 'Today') : `${ago}d ago`;
  if (ago < 365) return `${Math.round(ago / 30)}mo ago`;
  return `${(ago / 365).toFixed(1).replace(/\.0$/, '')}y ago`;
};
