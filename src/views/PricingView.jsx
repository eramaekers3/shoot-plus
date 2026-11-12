import { useMemo, useState } from 'react';
import { plural } from '../lib/text.js';
import { useBiz, money, sum, done, num, hourlyByService } from '../lib/biz.js';
import { openService, newBooking, open } from '../lib/open.js';
import CardStack from '../components/CardStack.jsx';
import { Icon } from '../components/ui.jsx';
import { VERSION, SOURCE, preview, applyWebsitePricing } from '../lib/websitePricing.js';
import { fmt } from '../lib/dates.js';

export default function PricingView() {
  const biz = useBiz();
  const cards = [
    { id: 'quote', title: 'Quick quote', node: biz.services.length ? <Quote biz={biz} /> : null },
    ...biz.services.map((s) => ({ id: s.id, title: s.name, node: <ServiceCard biz={biz} s={s} /> })),
  ];
  return (
    <>
      <header className="page-head">
        <h1>Pricing</h1>
        <p>What you charge for each kind of shoot, to check before you quote someone.</p>
      </header>
      {(biz.s.websitePricing || '') < VERSION && <WebsiteCard biz={biz} />}
      {biz.services.length === 0 && (
        <section className="card">
          <p className="empty" style={{ marginTop: 0 }}>Add your first service, like portraits, senior photos or a promo video.</p>
        </section>
      )}
      <CardStack page="pricing" cards={cards} />
      <button className="btn wide add-service" onClick={() => open('service', null)}>
        <Icon name="plus" size={18} /> Add a service
      </button>
      {(biz.s.websitePricing || '') >= VERSION && (
        <button className="link-btn center-link" onClick={() => applyWebsitePricing(biz.services)}>
          Prices match ethanramaekers.com ({fmt(biz.s.websitePricing, { month: 'short', day: 'numeric' })}) · apply again
        </button>
      )}
    </>
  );
}

function ServiceCard({ biz, s }) {
  const st = useMemo(() => sum(done(biz.live.filter((b) => b.serviceId === s.id))), [biz, s.id]);
  const hr = useMemo(() => hourlyByService(biz, biz.live.filter((b) => b.serviceId === s.id))[0], [biz, s.id]);
  const unit = s.unit === 'hour' ? '/hr' : '';
  return (
    <section className="card svc-card" style={{ '--c': s.color }} aria-labelledby={`sv-${s.id}`}>
      <div className="card-head">
        <h2 id={`sv-${s.id}`} className="svc-name"><i />{s.name}</h2>
        <span className="tag-kind">{s.kind === 'video' ? 'Video' : 'Photo'}</span>
      </div>
      <div className="svc-price">
        <b>{money(s.price)}<span>{unit}</span></b>
        {s.hours ? <span className="muted">{s.unit === 'hour' ? `${s.hours} hr minimum` : `${s.hours} hr`}</span> : null}
      </div>
      {s.includes && <p className="svc-inc">{s.includes}</p>}
      {(s.packages || []).length > 0 && (
        <ul className="pkg-list">
          {s.packages.map((p) => (
            <li key={p.id}>
              <span><b>{p.name}</b>{p.includes && <span className="muted small">{p.includes}</span>}</span>
              <b className="pkg-price">{money(p.price)}</b>
            </li>
          ))}
        </ul>
      )}
      {(s.addons || []).length > 0 && (
        <div className="addon-chips">
          {s.addons.map((a) => <span key={a.id} className="addon">+ {a.name} <b>{money(a.price)}</b></span>)}
        </div>
      )}
      {s.notes && <p className="muted small">{s.notes}</p>}
      {st.n > 0 && <p className="svc-stat">Booked {plural(st.n, 'time')} · avg {money(Math.round(st.avg))}{hr ? ` · you keep about ${money(Math.round(hr.rate))}/hr` : ''}{hr && hr.noEdit === hr.n ? ' (no editing time yet)' : ''}</p>}
      <div className="btn-row">
        <button className="mini" onClick={() => openService(s.id)}>Edit</button>
        <button className="mini sun" onClick={() => newBooking({ serviceId: s.id })}><Icon name="plus" size={14} /> Book this</button>
      </div>
    </section>
  );
}

/** Pick a service, package, hours and add-ons to get a price to quote. */
function Quote({ biz }) {
  const [sid, setSid] = useState(biz.services[0].id);
  const s = biz.serviceById[sid] || biz.services[0];
  const [pkg, setPkg] = useState('');
  const [hours, setHours] = useState('');
  const [adds, setAdds] = useState({}); // addon id → count
  const p = (s.packages || []).find((x) => x.id === pkg);
  const hrs = s.unit === 'hour' ? Math.max(num(hours) || s.hours || 1, s.hours || 0) : 0;
  const base = p ? num(p.price) : s.unit === 'hour' ? num(s.price) * hrs : num(s.price);
  const extras = (s.addons || []).reduce((t, a) => t + num(a.price) * (adds[a.id] || 0), 0);
  const total = base + extras;
  const pick = (id) => {
    setSid(id);
    setPkg('');
    setAdds({});
    setHours('');
  };
  const bump = (id, d) => setAdds({ ...adds, [id]: Math.max(0, (adds[id] || 0) + d) });
  return (
    <section className="card quote-card" aria-labelledby="q-h">
      <div className="card-head"><h2 id="q-h">Quick quote</h2><span className="meta">{money(total)}</span></div>
      <div className="chips scroll-chips" data-noswipe>
        {biz.services.map((x) => (
          <button key={x.id} className="chip cat-chip" style={{ '--c': x.color }} aria-pressed={sid === x.id} onClick={() => pick(x.id)}><i />{x.name}</button>
        ))}
      </div>
      {(s.packages || []).length > 0 && (
        <div className="chips q-row">
          {s.packages.map((x) => <button key={x.id} className="chip" aria-pressed={pkg === x.id} onClick={() => setPkg(pkg === x.id ? '' : x.id)}>{x.name} · {money(x.price)}</button>)}
        </div>
      )}
      {s.unit === 'hour' && (
        <label className="f q-row">
          Hours
          <input className="input num-in" inputMode="decimal" placeholder={String(s.hours || 1)} value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
      )}
      {(s.addons || []).length > 0 && (
        <ul className="rows q-adds">
          {s.addons.map((a) => (
            <li key={a.id} className="row">
              <span className="row-title">{a.name} <span className="muted small">{money(a.price)}</span></span>
              <span className="stepper">
                <button className="icon-btn sm" aria-label={`Fewer ${a.name}`} disabled={!adds[a.id]} onClick={() => bump(a.id, -1)}><Icon name="minus" size={16} /></button>
                <b className="q-n">{adds[a.id] || 0}</b>
                <button className="icon-btn sm" aria-label={`More ${a.name}`} onClick={() => bump(a.id, 1)}><Icon name="plus" size={16} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="q-total">
        <span>Quote</span>
        <b key={total}>{money(total)}</b>
      </div>
      <button
        className="btn wide"
        onClick={() =>
          newBooking({
            serviceId: s.id,
            pkg: p ? p.name : '',
            price: total,
            hours: s.unit === 'hour' ? hrs : p ? p.hours : s.hours,
            notes: (s.addons || []).filter((a) => adds[a.id]).map((a) => `${a.name}${adds[a.id] > 1 ? ` ×${adds[a.id]}` : ''}`).join(', '),
          })
        }
      >
        Book at this price
      </button>
    </section>
  );
}

/** Offers to copy the prices from your website into your services. */
function WebsiteCard({ biz }) {
  const [confirm, setConfirm] = useState(false);
  const plan = preview(biz.services);
  return (
    <section className="card web-card">
      <div className="card-head">
        <h2>Prices from your website</h2>
        <a className="meta" href={SOURCE} target="_blank" rel="noreferrer">ethanramaekers.com ↗</a>
      </div>
      <ul className="web-list">
        {plan.map((w) => (
          <li key={w.key}>
            <i style={{ background: (w.existing && w.existing.color) || w.color }} />
            <span>
              <b>{w.name}</b>
              <span className="muted small">
                {w.packages.length ? w.packages.map((p) => `${p.name} ${money(p.price)}`).join(' · ') : money(w.price)}
              </span>
            </span>
            <span className={`tag-kind${w.existing ? '' : ' new'}`}>{w.existing ? 'Update' : 'New'}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Services you already have keep their color and past bookings; anything not on your website stays as it is.
      </p>
      <button
        className={`btn wide${confirm ? '' : ' ghost'}`}
        onClick={() => {
          if (!confirm) return setConfirm(true);
          applyWebsitePricing(biz.services);
        }}
      >
        {confirm ? 'Tap again to update your prices' : 'Update from ethanramaekers.com'}
      </button>
    </section>
  );
}
