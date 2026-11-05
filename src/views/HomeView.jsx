import { useMemo } from 'react';
import { fmt, todayISO, parse } from '../lib/dates.js';
import {
  useBiz, sum, inMonth, inYear, done, ahead, money, thisMonth, prevMonth, thisYear, taxYear,
} from '../lib/biz.js';
import { goTab, newBooking } from '../lib/open.js';
import { plural } from '../lib/text.js';
import CardStack from '../components/CardStack.jsx';
import BookingRow from '../components/BookingRow.jsx';
import { CountUp, Icon, Ring } from '../components/ui.jsx';

export default function HomeView() {
  const biz = useBiz();
  const today = todayISO();
  const ym = thisMonth();
  const y = thisYear();
  const month = useMemo(() => sum(done(inMonth(biz.live, ym))), [biz, ym]);
  const last = useMemo(() => sum(inMonth(biz.live, prevMonth(ym))), [biz, ym]);
  const year = useMemo(() => sum(done(inYear(biz.live, y))), [biz, y]);
  const soon = useMemo(() => ahead(biz.live), [biz]);
  const recent = useMemo(() => done(biz.live).slice(0, 5), [biz]);
  const tax = useMemo(() => taxYear(biz, y), [biz, y]);
  const monthName = fmt(today, { month: 'long' });

  return (
    <>
      <header className="dayhead">
        <div>
          <div className="eyebrow">{biz.s.businessName || fmt(today, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <h1>
            <CountUp value={month.gross} format={money} />
            <span>earned in {monthName}{month.n ? ` · ${plural(month.n, 'shoot')}` : ''}</span>
          </h1>
        </div>
        {last.gross > 0 && (
          <div className={`vs ${month.gross >= last.gross ? 'pos' : 'neg'}`}>
            <b>{month.gross >= last.gross ? '▲' : '▼'} {money(Math.abs(month.gross - last.gross))}</b>
            <span>vs all of {fmt(`${prevMonth(ym)}-01`, { month: 'long' })}</span>
          </div>
        )}
      </header>

      <CardStack
        page="home"
        cards={[
          { id: 'year', title: 'This year', node: <YearCard biz={biz} year={year} y={y} /> },
          { id: 'soon', title: 'Coming up', node: <Soon biz={biz} list={soon} /> },
          { id: 'recent', title: 'Recent', node: <Recent biz={biz} list={recent} /> },
          { id: 'tax', title: 'Taxes', node: <TaxCard tax={tax} y={y} s={biz.s} /> },
        ]}
      />
    </>
  );
}

function YearCard({ biz, year, y }) {
  const goal = Number(biz.s.yearGoal) || 0;
  const dayOfYear = Math.round((parse(todayISO()) - parse(`${y}-01-01`)) / 864e5) + 1;
  const pace = goal ? (year.gross / goal) / (dayOfYear / 365) : 0;
  return (
    <section className="card" aria-labelledby="yr-h">
      <div className="card-head">
        <h2 id="yr-h">{y} so far</h2>
        <span className="meta">{plural(year.n, 'booking')}</span>
      </div>
      <div className="hero-row">
        <div>
          <div className="label">Income</div>
          <div className="big money-big"><CountUp value={year.gross} format={money} /></div>
        </div>
        {goal > 0 && (
          <Ring p={year.gross / goal} size={78} stroke={8}>
            <b>{Math.round((year.gross / goal) * 100)}%</b>
            <span>of {money(goal).replace(/,000$/, 'k')}</span>
          </Ring>
        )}
      </div>
      <div className="tiles tiles-3">
        <div className="tile"><span>Profit</span><b>{money(year.profit)}</b></div>
        <div className="tile"><span>For taxes</span><b>{money(year.tax)}</b></div>
        <div className="tile"><span>Yours to keep</span><b className="pos">{money(year.keep)}</b></div>
      </div>
      {goal > 0 && (
        <p className="muted small pace">
          {pace >= 1 ? 'Ahead of pace' : 'Behind pace'} for your {money(goal)} goal — on track for about {money((year.gross / dayOfYear) * 365)} this year.
        </p>
      )}
      <button className="link-btn" onClick={() => goTab('stats')}>All stats →</button>
    </section>
  );
}

function Soon({ biz, list }) {
  const total = list.reduce((t, b) => t + b.$.gross, 0);
  return (
    <section className="card" aria-labelledby="soon-h">
      <div className="card-head">
        <h2 id="soon-h">Coming up</h2>
        {list.length > 0 && <span className="meta">{money(total)} booked</span>}
      </div>
      {list.length ? (
        <ul className="rows">{list.slice(0, 6).map((b) => <BookingRow key={b.id} biz={biz} b={b} />)}</ul>
      ) : (
        <div className="empty-cta">
          <p className="empty">Nothing on the calendar yet.</p>
          <button className="mini sun" onClick={() => newBooking()}><Icon name="plus" size={14} /> Add a booking</button>
        </div>
      )}
    </section>
  );
}

function Recent({ biz, list }) {
  return (
    <section className="card" aria-labelledby="rec-h">
      <div className="card-head">
        <h2 id="rec-h">Recent</h2>
        <button className="mini" onClick={() => goTab('bookings')}>See all</button>
      </div>
      {list.length ? (
        <ul className="rows">{list.map((b) => <BookingRow key={b.id} biz={biz} b={b} />)}</ul>
      ) : (
        <p className="empty">Past bookings show up here. Tap + to add one.</p>
      )}
    </section>
  );
}

function TaxCard({ tax, y, s }) {
  const next = tax.next;
  return (
    <section className="card" aria-labelledby="tax-h">
      <div className="card-head">
        <h2 id="tax-h">Taxes</h2>
        <span className="meta">{s.taxRate}% of profit</span>
      </div>
      <div className="tax-line">
        <div><span>Set aside</span><b>{money(tax.setAside)}</b></div>
        <div><span>Paid</span><b>{money(tax.paid)}</b></div>
        <div className={tax.owed > 0 ? 'owe' : ''}><span>Still to pay</span><b>{money(tax.owed)}</b></div>
      </div>
      <div className="split tax-split" aria-hidden="true">
        <i style={{ width: `${tax.setAside ? Math.min(100, (tax.paid / tax.setAside) * 100) : 0}%`, background: 'var(--mint)' }} />
        <i style={{ flex: 1, background: 'var(--raised)' }} />
      </div>
      {next && (
        <p className="muted small">
          Next estimated payment due <b className="ink">{fmt(next.due, { month: 'long', day: 'numeric' })}</b> — about {money(next.tax)} for Q{next.q}.
        </p>
      )}
      <button className="link-btn" onClick={() => goTab('stats')}>Log a tax payment in Stats →</button>
    </section>
  );
}
