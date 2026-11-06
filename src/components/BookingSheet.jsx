import { useState } from 'react';
import { put, useRecord } from '../store.js';
import { fmt } from '../lib/dates.js';
import { useBiz, calc, titleOf, removeWithUndo, money } from '../lib/biz.js';
import { closeSheet, openClient, newBooking } from '../lib/open.js';
import { toast } from '../lib/toast.js';
import { unlink } from '../lib/stripe.js';
import { openPayment } from '../lib/open.js';
import { Sheet, Icon } from './ui.jsx';
import {
  ServicePick, PackagePick, DatePick, PlaceInput, ClientPick, MethodPick, ExpenseList, MoneySummary, MoneyIn, priceFor,
} from './BookingFields.jsx';

/** Every detail of a booking, all editable. Changes save as you make them. */
export default function BookingSheet({ id, onClose }) {
  const biz = useBiz();
  const b = useRecord(id);
  const [confirm, setConfirm] = useState(false);
  if (!b) return null;
  const s = biz.s;
  const sv = biz.serviceById[b.serviceId];
  const $ = calc(b, s);
  const set = (changes) => put('booking', { ...b, ...changes, updatedAt: Date.now() });

  return (
    <Sheet title={titleOf(biz, b)} onClose={onClose}>
      <p className="sheet-sub">{fmt(b.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{b.cancelled ? ' · Cancelled' : ''}</p>
      <MoneySummary $={$} s={s} />

      <section className="bs-sec">
        <h3 className="sub-h">Service</h3>
        <ServicePick biz={biz} value={b.serviceId} onPick={(serviceId) => set({ serviceId, pkg: '' })} />
        <PackagePick s={sv} value={b.pkg} onPick={(p) => set(p ? { pkg: p.name, price: p.price, hours: p.hours || b.hours } : { pkg: '' })} />
        <label className="f">
          Title <span className="muted-n">(optional — shown instead of the service name)</span>
          <input className="input" placeholder={sv ? sv.name : 'Booking'} value={b.title || ''} onChange={(e) => set({ title: e.target.value })} />
        </label>
      </section>

      <section className="bs-sec">
        <h3 className="sub-h">When & where</h3>
        <DatePick value={b.date} onChange={(date) => set({ date })} />
        <div className="form-grid">
          <label className="f">
            Time
            <input className="input" type="time" value={b.time || ''} onChange={(e) => set({ time: e.target.value })} />
          </label>
          <label className="f">
            Hours
            <input className="input" inputMode="decimal" placeholder="1" value={b.hours ?? ''} onChange={(e) => set({ hours: e.target.value })} />
          </label>
          <div className="f full">
            Location
            <PlaceInput biz={biz} value={b.location} onChange={(location) => set({ location })} />
          </div>
        </div>
      </section>

      <section className="bs-sec">
        <div className="sub-head">
          <h3 className="sub-h">Client</h3>
          {b.clientId && biz.clientById[b.clientId] && <button className="mini" onClick={() => openClient(b.clientId)}>Open</button>}
        </div>
        <ClientPick biz={biz} value={b.clientId} onChange={(clientId) => set({ clientId })} />
      </section>

      <section className="bs-sec">
        <h3 className="sub-h">Payment</h3>
        <div className="form-grid">
          <label className="f">
            Price
            <MoneyIn value={b.price} onChange={(price) => set({ price })} />
          </label>
          <label className="f">
            Tip
            <MoneyIn value={b.tip} onChange={(tip) => set({ tip })} />
          </label>
        </div>
        {sv && priceFor(sv, b.pkg, b.hours) !== $.price && (
          <button className="link-btn" onClick={() => set({ price: priceFor(sv, b.pkg, b.hours) })}>
            Use your listed price ({money(priceFor(sv, b.pkg, b.hours))})
          </button>
        )}
        {b.stripeId && (
          <div className="stripe-line">
            <Icon name="card" size={16} />
            <span>Paid through Stripe</span>
            <button className="mini" onClick={() => openPayment(b.stripeId)}>Payment</button>
            <button className="mini" onClick={() => { unlink(b); toast('Stripe payment detached'); }}>Detach</button>
          </div>
        )}
        <div className="f">
          Paid with
          <MethodPick methods={s.methods} value={b.method} onChange={(method) => set({ method })} />
        </div>
      </section>

      <section className="bs-sec">
        <h3 className="sub-h">Expenses</h3>
        <label className="f miles">
          Miles driven <span className="muted-n">({money(s.mileRate)}/mile = {money($.mileage)})</span>
          <input className="input num-in" inputMode="decimal" placeholder="0" value={b.miles ?? ''} onChange={(e) => set({ miles: e.target.value })} />
        </label>
        <ExpenseList value={b.expenses || []} onChange={(expenses) => set({ expenses })} />
      </section>

      <section className="bs-sec">
        <label className="f">
          Notes
          <textarea className="input" rows={3} placeholder="Shot list, gallery link, what to remember…" value={b.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </section>

      <div className="btn-row edit-sec">
        <button className="btn ghost" onClick={() => {
          const { id: _id, ...rest } = b;
          newBooking({ ...rest, date: undefined, stripeId: undefined });
        }}>
          <Icon name="copy" size={16} /> Duplicate
        </button>
        <button className="btn ghost" onClick={() => { set({ cancelled: !b.cancelled }); toast(b.cancelled ? 'Booking restored' : 'Marked cancelled — left out of stats'); }}>
          {b.cancelled ? 'Un-cancel' : 'Cancelled'}
        </button>
        <button
          className={`btn ${confirm ? 'danger' : 'ghost'}`}
          onClick={() => {
            if (!confirm) return setConfirm(true);
            removeWithUndo('booking', id, 'Booking');
            closeSheet();
          }}
        >
          {confirm ? 'Tap again to delete' : 'Delete'}
        </button>
      </div>
    </Sheet>
  );
}
