import { fmt } from '../lib/dates.js';
import { money, titleOf, clientName, colorOf, relDate } from '../lib/biz.js';
import { openBooking } from '../lib/open.js';

/** One booking in a list: a date tile in its service color, what it was, who, and what it earned. */
export default function BookingRow({ biz, b, showYear = false, amount = 'gross' }) {
  const rel = relDate(b.date);
  const who = clientName(biz, b.clientId);
  return (
    <li className={`row bk-row${b.cancelled ? ' cancelled' : ''}`} style={{ '--c': colorOf(biz, b) }}>
      <button className="bk-open" onClick={() => openBooking(b.id)}>
        <span className="bk-date" aria-hidden="true">
          <b>{fmt(b.date, { day: 'numeric' })}</b>
          <span>{fmt(b.date, showYear ? { month: 'short', year: '2-digit' } : { month: 'short' })}</span>
        </span>
        <span className="row-title bk-text">
          <span className="bk-title">{titleOf(biz, b)}</span>
          <span className="bk-meta">
            {rel && <span className="bk-rel">{rel}</span>}
            {who && <span>{who}</span>}
            {b.location && <span>{b.location}</span>}
            {b.cancelled && <span className="neg">Cancelled</span>}
          </span>
        </span>
        <span className="bk-amt">
          <b>{money(amount === 'profit' ? b.$.profit : b.$.gross)}</b>
          {b.$.costs > 0 && amount !== 'profit' && <span>{money(b.$.profit)} profit</span>}
        </span>
      </button>
    </li>
  );
}
