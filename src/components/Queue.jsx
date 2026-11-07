// The editing queue on Home: shoots that still need their gallery delivered, soonest due first.
import { useRef } from 'react';
import { put } from '../store.js';
import { fmt, todayISO } from '../lib/dates.js';
import { plural } from '../lib/text.js';
import { useBiz, editQueue, titleOf, clientName, colorOf } from '../lib/biz.js';
import { openBooking } from '../lib/open.js';
import { haptic } from '../lib/haptics.js';
import { cheer } from '../lib/cheer.js';
import { toast } from '../lib/toast.js';
import { Icon } from './ui.jsx';

export const dueLabel = (days) =>
  days < 0 ? `${plural(-days, 'day')} late` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`;

/** Marks a gallery delivered today, with a little celebration and an Undo. */
export function deliver(b, el) {
  const { $: _m, ...rest } = b;
  put('booking', { ...rest, delivered: todayISO(), updatedAt: Date.now() });
  haptic('success');
  if (el) cheer(el, { text: 'Delivered' });
  toast('Gallery delivered', { label: 'Undo', run: () => put('booking', { ...rest, delivered: '', updatedAt: Date.now() }) });
}

export function EditQueue() {
  const biz = useBiz();
  const queue = editQueue(biz);
  if (!queue.length) return null;
  const late = queue.filter((q) => q.days < 0).length;
  return (
    <section className={`card queue-card${late ? ' has-late' : ''}`} aria-labelledby="q-h">
      <div className="card-head">
        <h2 id="q-h">To edit</h2>
        <span className={`meta${late ? ' neg' : ''}`}>{late ? `${late} late` : `${queue.length} ${queue.length === 1 ? 'gallery' : 'galleries'}`}</span>
      </div>
      <ul className="rows">
        {queue.slice(0, 8).map((q) => <QueueRow key={q.b.id} biz={biz} {...q} />)}
      </ul>
      {queue.length > 8 && <p className="muted small">+{queue.length - 8} more in Bookings.</p>}
    </section>
  );
}

function QueueRow({ biz, b, due, days }) {
  const btn = useRef(null);
  const who = clientName(biz, b.clientId);
  return (
    <li className="row q-row-item" style={{ '--c': colorOf(biz, b) }}>
      <button
        ref={btn}
        className="q-check"
        aria-label={`Mark ${titleOf(biz, b)} delivered`}
        onClick={() => deliver(b, btn.current)}
      >
        <Icon name="check" size={16} />
      </button>
      <button className="bk-open" onClick={() => openBooking(b.id)}>
        <span className="row-title bk-text">
          <span className="bk-title">{who || titleOf(biz, b)}</span>
          <span className="bk-meta">
            <span>{who ? titleOf(biz, b) : fmt(b.date, { month: 'short', day: 'numeric' })}</span>
            <span>shot {fmt(b.date, { month: 'short', day: 'numeric' })}</span>
          </span>
        </span>
        <span className={`due-tag${days < 0 ? ' late' : days <= 1 ? ' soon' : ''}`} title={fmt(due, { month: 'long', day: 'numeric' })}>{dueLabel(days)}</span>
      </button>
    </li>
  );
}
