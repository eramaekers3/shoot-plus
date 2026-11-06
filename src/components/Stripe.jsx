// Stripe payments in the app: the "New payments" card on Home and the sheet for one payment.
import { useMemo } from 'react';
import { useRecord } from '../store.js';
import { fmt } from '../lib/dates.js';
import { plural } from '../lib/text.js';
import { useBiz, money, num } from '../lib/biz.js';
import { useStripe, useStripeStatus, syncStripe, presetFrom, linkTo, ignore, ignoreAll } from '../lib/stripe.js';
import { matchesFor } from '../lib/stripe.js';
import { openPayment, newBooking, closeSheet } from '../lib/open.js';
import { Sheet, Icon } from './ui.jsx';
import BookingRow from './BookingRow.jsx';

const kept = (p) => num(p.amount) - num(p.refunded);

/** Home card: payments that came in through Stripe and aren't on a booking yet. Hidden when there are none. */
export function NewPayments() {
  const all = useStripe();
  const st = useStripeStatus();
  const waiting = useMemo(() => all.filter((p) => p.status === 'new').sort((a, b) => b.created - a.created), [all]);
  if (!waiting.length) return null;
  const total = waiting.reduce((t, p) => t + kept(p), 0);
  return (
    <section className="card stripe-card" aria-labelledby="sp-h">
      <div className="card-head">
        <h2 id="sp-h">New from Stripe</h2>
        <span className="meta">{money(total)}</span>
      </div>
      <ul className="rows">
        {waiting.slice(0, 6).map((p) => (
          <li className="row" key={p.id}>
            <button className="bk-open" onClick={() => openPayment(p.id)}>
              <span className="pay-mark" aria-hidden="true"><Icon name={p.via === 'Tap to Pay' ? 'phone' : 'card'} size={18} /></span>
              <span className="row-title bk-text">
                <span className="bk-title">{p.name || p.what || 'Payment'}</span>
                <span className="bk-meta">
                  <span>{fmt(p.date, { month: 'short', day: 'numeric' })}</span>
                  <span>{p.via}</span>
                  {p.name && p.what && <span>{p.what}</span>}
                </span>
              </span>
              <span className="bk-amt">
                <b>{money(kept(p))}</b>
                {p.fee ? <span>{money(p.fee)} fee</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="btn-row">
        {waiting.length > 6 && <span className="muted small">+{waiting.length - 6} more</span>}
        <button className="mini" onClick={() => syncStripe(true)} disabled={st.syncing}>{st.syncing ? 'Checking…' : 'Check now'}</button>
        {waiting.length > 1 && <button className="mini" onClick={() => ignoreAll(waiting)}>Hide all</button>}
      </div>
      <p className="muted small">Tap one to add it as a booking or attach it to one you already logged.</p>
    </section>
  );
}

/** One Stripe payment: add it as a booking, attach it to a booking, or hide it. */
export function PaymentSheet({ id, onClose }) {
  const biz = useBiz();
  const p = useRecord(id);
  const matches = useMemo(() => (p ? matchesFor(biz, p) : []), [biz, p]);
  if (!p) return null;
  const linked = p.bookingId && biz.all.find((b) => b.id === p.bookingId);
  return (
    <Sheet title={money(kept(p))} onClose={onClose}>
      <p className="sheet-sub">
        {p.name || 'Someone'} paid {fmt(p.date, { weekday: 'long', month: 'long', day: 'numeric' })} · {p.via}{p.method && p.method !== p.via ? ` (${p.method})` : ''}
      </p>
      <div className="m-sum">
        <div><span>Paid</span><b>{money(p.amount)}</b></div>
        <div className="minus"><span>Refunded</span><b>{money(p.refunded || 0)}</b></div>
        <div className="minus"><span>Stripe fee</span><b>{p.fee == null ? '—' : money(p.fee)}</b></div>
        <div className="keep"><span>To your bank</span><b>{p.net == null ? '—' : money(p.net - num(p.refunded))}</b></div>
      </div>
      {(p.what || p.email) && (
        <ul className="pay-facts">
          {p.what && <li><span>For</span><b>{p.what}</b></li>}
          {p.email && <li><span>Email</span><b>{p.email}</b></li>}
        </ul>
      )}
      {p.receipt && <a className="link-btn" href={p.receipt} target="_blank" rel="noreferrer">Stripe receipt ↗</a>}

      {linked ? (
        <section className="bs-sec">
          <h3 className="sub-h">On this booking</h3>
          <ul className="rows"><BookingRow biz={biz} b={linked} showYear /></ul>
        </section>
      ) : (
        <>
          <button className="btn wide" onClick={() => newBooking(presetFrom(p))}>
            <Icon name="plus" size={18} /> Add as a new booking
          </button>
          {matches.length > 0 && (
            <section className="bs-sec" style={{ marginTop: 14 }}>
              <h3 className="sub-h">Or attach it to a booking you logged</h3>
              <ul className="rows">
                {matches.map((b) => (
                  <li className="row match-row" key={b.id}>
                    <ul className="rows grow-1"><BookingRow biz={biz} b={b} showYear /></ul>
                    <button className="mini sun" onClick={() => { linkTo(p, b); closeSheet(); }}>Attach</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="btn-row edit-sec">
            {p.status === 'ignored' ? (
              <span className="muted small">Hidden from Home.</span>
            ) : (
              <button className="btn ghost" onClick={() => { ignore(p); closeSheet(); }}>Not a booking — hide it</button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Settings → Stripe: whether it's working, a manual check, and how to set it up. */
export function StripeSettings({ signedIn }) {
  const st = useStripeStatus();
  const all = useStripe();
  const waiting = all.filter((p) => p.status === 'new').length;
  return (
    <section className="set-sec">
      <h3>Stripe</h3>
      {!signedIn ? (
        <p className="muted small">Sign in above first. Stripe payments come in through your account.</p>
      ) : st.notSetUp ? (
        <>
          <p className="err">{st.error || 'Not set up yet.'}</p>
          <SetupSteps />
        </>
      ) : (
        <>
          <p className="muted small">
            {all.length
              ? `${plural(all.length, 'payment')} pulled in${waiting ? `, ${waiting} waiting on Home` : ''}.`
              : 'Payments from payment links, Tap to Pay and your website checkout show up on Home.'}
            {st.lastSync ? ` Checked ${new Date(st.lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : ''}
          </p>
          {st.error && <p className="err">{st.error}</p>}
          <div className="btn-row">
            <button className="btn ghost" onClick={() => syncStripe(true)} disabled={st.syncing}>{st.syncing ? 'Checking…' : 'Check Stripe now'}</button>
          </div>
          <details className="setup-details">
            <summary>How it’s set up</summary>
            <SetupSteps />
          </details>
        </>
      )}
    </section>
  );
}

function SetupSteps() {
  return (
    <ol className="steps">
      <li>In Stripe, open <b>Developers → API keys → Create restricted key</b>. Name it shoot+ and give it <b>Read</b> on <b>Charges</b>, <b>Checkout Sessions</b> and <b>Balance</b>. Leave everything else as None.</li>
      <li>In Vercel → shoot-plus → <b>Settings → Environment Variables</b>, add <code>STRIPE_SECRET_KEY</code> (the rk_live_… key) and <code>STRIPE_OWNER_EMAIL</code> (the email you sign in with here). Redeploy.</li>
      <li>Come back and tap <b>Check Stripe now</b>. The first check pulls in the last 90 days.</li>
    </ol>
  );
}
