import { useRef, useState } from 'react';
import { todayISO, fmt } from '../lib/dates.js';
import { useBiz, calc, saveBooking, money } from '../lib/biz.js';
import { haptic } from '../lib/haptics.js';
import { cheer } from '../lib/cheer.js';
import { Sheet, Icon } from './ui.jsx';
import {
  ServicePick, PackagePick, DatePick, PlaceInput, ClientPick, MethodPick, ExpenseList, MoneySummary, MoneyIn, priceFor,
} from './BookingFields.jsx';

const STEPS = ['What', 'When', 'Who', 'Money'];

/** Adding a booking, one question at a time. preset can fill in anything ahead of time. */
export default function NewBooking({ preset = {}, onClose }) {
  const biz = useBiz();
  const s = biz.s;
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(null);
  const [b, setB] = useState(() => ({
    serviceId: '', pkg: '', title: '', date: todayISO(), time: '', hours: '', location: '', clientId: '',
    price: '', tip: '', method: '', miles: '', expenses: [], notes: '', ...Object.fromEntries(Object.entries(preset || {}).filter(([, v]) => v !== undefined)),
  }));
  const [showExp, setShowExp] = useState((b.expenses || []).length > 0 || !!b.miles);
  const sheet = useRef(null);
  const sv = biz.serviceById[b.serviceId];
  const set = (changes) => setB((x) => ({ ...x, ...changes }));
  const $ = calc(b, s);

  // Picking a service or package fills in its price and length (until you type your own price).
  const [priceTouched, setPriceTouched] = useState(b.price !== '');
  const pickService = (serviceId) => {
    const next = biz.serviceById[serviceId];
    const changes = { serviceId, pkg: '' };
    if (next) {
      changes.hours = next.hours || '';
      if (!priceTouched) changes.price = priceFor(next, '', next.hours);
    }
    set(changes);
  };
  const pickPkg = (p) => {
    if (!p) return set({ pkg: '' });
    set({ pkg: p.name, hours: p.hours || b.hours, ...(priceTouched ? {} : { price: p.price }) });
  };

  const save = () => {
    const out = saveBooking({ ...b, createdAt: Date.now() });
    haptic('success');
    const fab = document.querySelector('.fab');
    setSaved(out);
    setTimeout(() => cheer(fab, { text: `+${money($.gross)}`, sub: `${money($.keep)} to keep` }), 380);
    setTimeout(onClose, 1500);
  };

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : save());

  if (saved) {
    return (
      <Sheet title="Booked" onClose={onClose}>
        <div className="cap-done">
          <svg className="cap-check" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" />
            <path d="M30 52 44 66 71 36" />
          </svg>
          <p className="cap-done-title">{money($.gross)} · {sv ? sv.name : 'Booking'}</p>
          <p className="muted">{fmt(b.date, { weekday: 'long', month: 'long', day: 'numeric' })}{b.clientId && biz.clientById[b.clientId] ? ` · ${biz.clientById[b.clientId].name}` : ''}</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="New booking" onClose={onClose}>
      <ol className="steps-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((x, i) => <li key={x} className={i === step ? 'on' : i < step ? 'past' : ''} />)}
      </ol>
      <p className="task-so-far" ref={sheet}>
        {sv ? sv.name : 'A booking'}{b.pkg ? ` — ${b.pkg}` : ''}
        {b.price !== '' && <span className="so-far-price"> · {money($.gross)}</span>}
      </p>

      <div className="cap-step" key={step}>
        {step === 0 && (
          <div className="cap-q">
            <p className="cap-label">What kind of shoot?</p>
            <ServicePick biz={biz} value={b.serviceId} onPick={pickService} />
            <PackagePick s={sv} value={b.pkg} onPick={pickPkg} />
            <div className="form-grid">
              <label className="f">
                Price
                <MoneyIn value={b.price} onChange={(price) => { setPriceTouched(true); set({ price }); }} />
              </label>
              <label className="f">
                Hours
                <input className="input" inputMode="decimal" placeholder="1" value={b.hours ?? ''}
                  onChange={(e) => set({ hours: e.target.value, ...(sv && sv.unit === 'hour' && !priceTouched && !b.pkg ? { price: priceFor(sv, '', e.target.value) } : {}) })} />
              </label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="cap-q">
            <p className="cap-label">When was it?</p>
            <DatePick value={b.date} onChange={(date) => set({ date })} />
            <div className="form-grid">
              <label className="f">
                Time <span className="muted-n">(optional)</span>
                <input className="input" type="time" value={b.time} onChange={(e) => set({ time: e.target.value })} />
              </label>
              <div className="f full">
                Where
                <PlaceInput biz={biz} value={b.location} onChange={(location) => set({ location })} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="cap-q">
            <p className="cap-label">Who was it for?</p>
            <ClientPick biz={biz} value={b.clientId} onChange={(clientId) => set({ clientId })} autoFocus={!b.clientId} />
          </div>
        )}

        {step === 3 && (
          <div className="cap-q">
            <p className="cap-label">How was it paid?</p>
            <div className="form-grid">
              <label className="f">
                Price
                <MoneyIn value={b.price} onChange={(price) => { setPriceTouched(true); set({ price }); }} />
              </label>
              <label className="f">
                Tip
                <MoneyIn value={b.tip} onChange={(tip) => set({ tip })} />
              </label>
            </div>
            <div className="f">
              Paid with
              <MethodPick methods={s.methods} value={b.method} onChange={(method) => set({ method })} />
            </div>
            {showExp ? (
              <div className="f">
                Expenses
                <label className="f miles">
                  Miles driven <span className="muted-n">({money(s.mileRate)}/mile)</span>
                  <input className="input num-in" inputMode="decimal" placeholder="0" value={b.miles} onChange={(e) => set({ miles: e.target.value })} />
                </label>
                <ExpenseList value={b.expenses} onChange={(expenses) => set({ expenses })} />
              </div>
            ) : (
              <button type="button" className="link-btn" onClick={() => setShowExp(true)}>+ Miles or expenses</button>
            )}
            <label className="f">
              Notes
              <textarea className="input" rows={2} placeholder="Anything to remember" value={b.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
            <MoneySummary $={$} s={s} />
          </div>
        )}
      </div>

      <div className="cap-nav">
        {step > 0 && (
          <button type="button" className="btn ghost" onClick={() => setStep(step - 1)} aria-label="Back"><Icon name="left" /></button>
        )}
        <button type="button" className="btn" onClick={next}>
          {step < STEPS.length - 1 ? (
            <>{step === 2 && !b.clientId ? 'Skip' : 'Next'} <Icon name="right" size={18} /></>
          ) : (
            <><Icon name="check" size={18} /> Save booking</>
          )}
        </button>
      </div>
      {step < STEPS.length - 1 && b.price !== '' && (
        <button type="button" className="link-btn center-link" onClick={save}>Save now</button>
      )}
    </Sheet>
  );
}
