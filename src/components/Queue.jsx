// The editing queue on Home: shoots with steps left to do, soonest gallery due date first.
import { useRef, useState } from 'react';
import { put } from '../store.js';
import { fmt, todayISO } from '../lib/dates.js';
import { plural } from '../lib/text.js';
import { useBiz, editQueue, titleOf, clientName, colorOf } from '../lib/biz.js';
import { openBooking } from '../lib/open.js';
import { haptic } from '../lib/haptics.js';
import { cheer } from '../lib/cheer.js';
import { toast } from '../lib/toast.js';
import { Icon } from './ui.jsx';
import StepList, { StepBar } from './Steps.jsx';
import { stepsOf, progress, checkNext } from '../lib/steps.js';

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
  const late = queue.filter((q) => q.days < 0 && !q.b.delivered).length;
  return (
    <section className={`card queue-card${late ? ' has-late' : ''}`} aria-labelledby="q-h">
      <div className="card-head">
        <h2 id="q-h">To edit</h2>
        <span className={`meta${late ? ' neg' : ''}`}>{late ? `${late} late` : plural(queue.length, 'shoot')}</span>
      </div>
      <ul className="rows">
        {queue.slice(0, 8).map((q) => <QueueRow key={q.b.id} biz={biz} {...q} />)}
      </ul>
      {queue.length > 8 && <p className="muted small">+{queue.length - 8} more in Bookings.</p>}
    </section>
  );
}

/** One shoot in the queue: check off its next step, or tap it to see every step. */
function QueueRow({ biz, b, due, days }) {
  const btn = useRef(null);
  const [open, setOpen] = useState(false);
  const who = clientName(biz, b.clientId);
  const steps = stepsOf(biz, b);
  const p = progress(steps);
  const tag = b.delivered
    ? { text: `${p.total - p.done} left`, cls: '' }
    : { text: dueLabel(days), cls: days < 0 ? ' late' : days <= 1 ? ' soon' : '' };
  return (
    <li className={`row q-row-item${open ? ' open' : ''}`} style={{ '--c': colorOf(biz, b) }}>
      <div className="q-main">
        <button
          ref={btn}
          className="q-check"
          aria-label={p.next ? `Check off ${p.next.label} for ${who || titleOf(biz, b)}` : 'Done'}
          onClick={() => checkNext(biz, b, btn.current)}
        >
          <Icon name="check" size={16} />
        </button>
        <button className="bk-open" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="row-title bk-text">
            <span className="bk-title">{who || titleOf(biz, b)}</span>
            <span className="bk-meta">
              {p.next && <span className="q-next">{p.next.label}</span>}
              <span>{who ? titleOf(biz, b) : `shot ${fmt(b.date, { month: 'short', day: 'numeric' })}`}</span>
            </span>
          </span>
          <span className="q-side">
            <span className={`due-tag${tag.cls}`} title={`Gallery due ${fmt(due, { month: 'long', day: 'numeric' })}`}>{tag.text}</span>
            <span className="q-count">{p.done}/{p.total}</span>
          </span>
        </button>
      </div>
      <StepBar steps={steps} />
      {open && (
        <div className="q-steps">
          <StepList biz={biz} b={b} />
          <button className="link-btn" onClick={() => openBooking(b.id)}>Open booking →</button>
        </div>
      )}
    </li>
  );
}
