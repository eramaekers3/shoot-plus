import { useState } from 'react';
import { put, useRecord } from '../store.js';
import { newId } from '../lib/ids.js';
import { useBiz, SERVICE_COLORS, num, removeWithUndo } from '../lib/biz.js';
import { closeSheet } from '../lib/open.js';
import { toast } from '../lib/toast.js';
import { Sheet, Icon } from './ui.jsx';

const BLANK = { name: '', kind: 'photo', color: SERVICE_COLORS[0], unit: 'flat', price: '', hours: 1, includes: '', notes: '', packages: [], addons: [] };

/** Everything about one service you offer: price, what's included, packages and add-ons. */
export default function ServiceSheet({ id, onClose }) {
  const biz = useBiz();
  const saved = useRecord(id);
  const [draft, setDraft] = useState(() => ({ ...BLANK, color: SERVICE_COLORS[biz.services.length % SERVICE_COLORS.length] }));
  const [confirm, setConfirm] = useState(false);
  const isNew = !id;
  const s = isNew ? draft : saved;
  if (!s) return null;

  const save = (next) => (isNew ? setDraft(next) : put('service', next));
  const set = (k, v) => save({ ...s, [k]: v });
  const setIn = (listKey, itemId, k, v) => set(listKey, (s[listKey] || []).map((x) => (x.id === itemId ? { ...x, [k]: v } : x)));
  const addTo = (listKey, item) => set(listKey, [...(s[listKey] || []), { id: newId(), ...item }]);
  const dropFrom = (listKey, itemId) => set(listKey, (s[listKey] || []).filter((x) => x.id !== itemId));
  const used = isNew ? 0 : biz.all.filter((b) => b.serviceId === id).length;

  return (
    <Sheet title={isNew ? 'New service' : 'Edit service'} onClose={onClose}>
      <div className="form-grid">
        <label className="f full">
          Name
          <input className="input" placeholder="Portrait session" value={s.name} onChange={(e) => set('name', e.target.value)} autoFocus={isNew} />
        </label>
        <div className="f">
          Kind
          <div className="seg" role="group" aria-label="Kind">
            <button aria-pressed={s.kind !== 'video'} onClick={() => set('kind', 'photo')}>Photo</button>
            <button aria-pressed={s.kind === 'video'} onClick={() => set('kind', 'video')}>Video</button>
          </div>
        </div>
        <div className="f">
          Priced
          <div className="seg" role="group" aria-label="Priced">
            <button aria-pressed={s.unit !== 'hour'} onClick={() => set('unit', 'flat')}>Flat</button>
            <button aria-pressed={s.unit === 'hour'} onClick={() => set('unit', 'hour')}>Hourly</button>
          </div>
        </div>
        <label className="f">
          {s.unit === 'hour' ? 'Price per hour' : 'Price'}
          <input className="input" inputMode="decimal" placeholder="$0" value={s.price} onChange={(e) => set('price', e.target.value)} onBlur={() => set('price', num(s.price))} />
        </label>
        <label className="f">
          {s.unit === 'hour' ? 'Minimum hours' : 'Hours'}
          <input className="input" inputMode="decimal" value={s.hours ?? ''} onChange={(e) => set('hours', e.target.value)} onBlur={() => set('hours', num(s.hours))} />
        </label>
        <label className="f full">
          What’s included
          <textarea className="input" rows={2} placeholder="1 hour, 25+ edited photos, online gallery" value={s.includes || ''} onChange={(e) => set('includes', e.target.value)} />
        </label>
        <div className="f full">
          Color
          <div className="swatches" role="group" aria-label="Color">
            {SERVICE_COLORS.map((c) => <button key={c} className="swatch" style={{ '--c': c }} aria-pressed={s.color === c} aria-label={c} onClick={() => set('color', c)} />)}
            <label className={`swatch swatch-custom${SERVICE_COLORS.includes(s.color) ? '' : ' on'}`} title="Pick any color">
              <input type="color" value={s.color} onChange={(e) => set('color', e.target.value)} aria-label="Pick any color" />
            </label>
          </div>
        </div>
      </div>

      <div className="edit-sec">
        <div className="sub-head">
          <h3 className="sub-h">Packages</h3>
          <button className="mini" onClick={() => addTo('packages', { name: '', price: '', hours: '', includes: '' })}><Icon name="plus" size={14} /> Package</button>
        </div>
        {(s.packages || []).length === 0 && <p className="muted small">Optional tiers, like Mini, Standard and Extended.</p>}
        {(s.packages || []).map((p) => (
          <div className="item-edit" key={p.id}>
            <div className="item-line">
              <input className="input" placeholder="Name" value={p.name} onChange={(e) => setIn('packages', p.id, 'name', e.target.value)} />
              <input className="input num-in" inputMode="decimal" placeholder="$" value={p.price} onChange={(e) => setIn('packages', p.id, 'price', e.target.value)} onBlur={() => setIn('packages', p.id, 'price', num(p.price))} />
              <button className="x" aria-label="Remove package" onClick={() => dropFrom('packages', p.id)}>×</button>
            </div>
            <div className="item-line">
              <input className="input" placeholder="What’s included" value={p.includes || ''} onChange={(e) => setIn('packages', p.id, 'includes', e.target.value)} />
              <input className="input num-in" inputMode="decimal" placeholder="hrs" value={p.hours ?? ''} onChange={(e) => setIn('packages', p.id, 'hours', e.target.value)} onBlur={() => setIn('packages', p.id, 'hours', num(p.hours))} />
              <span className="x-space" />
            </div>
          </div>
        ))}
      </div>

      <div className="edit-sec">
        <div className="sub-head">
          <h3 className="sub-h">Add-ons</h3>
          <button className="mini" onClick={() => addTo('addons', { name: '', price: '' })}><Icon name="plus" size={14} /> Add-on</button>
        </div>
        {(s.addons || []).length === 0 && <p className="muted small">Extras you charge for, like rush delivery or an extra location.</p>}
        {(s.addons || []).map((a) => (
          <div className="item-line" key={a.id}>
            <input className="input" placeholder="Name" value={a.name} onChange={(e) => setIn('addons', a.id, 'name', e.target.value)} />
            <input className="input num-in" inputMode="decimal" placeholder="$" value={a.price} onChange={(e) => setIn('addons', a.id, 'price', e.target.value)} onBlur={() => setIn('addons', a.id, 'price', num(a.price))} />
            <button className="x" aria-label="Remove add-on" onClick={() => dropFrom('addons', a.id)}>×</button>
          </div>
        ))}
      </div>

      <label className="f full edit-sec">
        Notes for yourself
        <textarea className="input" rows={2} placeholder="Deposit policy, travel fee past 20 miles…" value={s.notes || ''} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {isNew ? (
        <button
          className="btn wide"
          disabled={!draft.name.trim()}
          onClick={() => {
            put('service', { ...draft, name: draft.name.trim(), price: num(draft.price), hours: num(draft.hours), order: biz.services.length });
            toast(`${draft.name.trim()} added`);
            closeSheet();
          }}
        >
          Add service
        </button>
      ) : (
        <div className="btn-row edit-sec">
          <button
            className={`btn ${confirm ? 'danger' : 'ghost'}`}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              removeWithUndo('service', id, 'Service');
              closeSheet();
            }}
          >
            {confirm ? 'Tap again to delete' : 'Delete service'}
          </button>
          {confirm && used > 0 && <p className="muted small">{used} past booking{used === 1 ? '' : 's'} keep their price but lose the service name.</p>}
        </div>
      )}
    </Sheet>
  );
}
