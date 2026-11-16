// A shoot's checklist: tap a step to check it off. In the booking sheet the list is editable too
// (rename by tapping the text, remove with ×, add your own, or start over from the service).
import { useState } from 'react';
import { stepsOf, toggleStep, saveSteps, newStep, stepsFor, progress } from '../lib/steps.js';
import { Icon } from './ui.jsx';

/** A thin bar with one segment per step. */
export function StepBar({ steps }) {
  return (
    <span className="step-bar" aria-hidden="true">
      {steps.map((x) => <i key={x.id} className={x.done ? 'on' : ''} />)}
    </span>
  );
}

export default function StepList({ biz, b, editable = false }) {
  const steps = stepsOf(biz, b);
  const [adding, setAdding] = useState('');
  const p = progress(steps);
  const save = (next) => saveSteps(b, next, { quiet: true });
  const sv = biz.serviceById[b.serviceId];

  return (
    <div className="step-list">
      <ul>
        {steps.map((x) => (
          <li key={x.id} className={`step${x.done ? ' done' : ''}${p.next && p.next.id === x.id ? ' next' : ''}`}>
            <button type="button" className="step-check" aria-pressed={x.done} aria-label={`${x.done ? 'Uncheck' : 'Check off'} ${x.label}`}
              onClick={(e) => toggleStep(biz, b, x.id, e.currentTarget)}>
              <Icon name="check" size={14} />
            </button>
            {editable ? (
              <input className="step-label" value={x.label} aria-label="Step"
                onChange={(e) => save(steps.map((y) => (y.id === x.id ? { ...y, label: e.target.value } : y)))} />
            ) : (
              <button type="button" className="step-label" onClick={(e) => toggleStep(biz, b, x.id, e.currentTarget.previousSibling)}>{x.label}</button>
            )}
            {editable && (
              <button type="button" className="x" aria-label={`Remove ${x.label}`} onClick={() => save(steps.filter((y) => y.id !== x.id))}>×</button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <>
          <form className="step-add" onSubmit={(e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            // New steps go before "Gallery delivered" / "Everything finished".
            const at = steps.findIndex((y) => y.tag === 'deliver' || y.tag === 'final');
            const next = [...steps];
            next.splice(at < 0 ? next.length : at, 0, newStep(adding.trim()));
            save(next);
            setAdding('');
          }}>
            <input className="input" placeholder="Add a step" value={adding} onChange={(e) => setAdding(e.target.value)} />
            <button className="mini" disabled={!adding.trim()}><Icon name="plus" size={14} /> Add</button>
          </form>
          {sv && (
            <button type="button" className="link-btn" onClick={() => save(stepsFor(sv, b.pkg, b.date))}>
              Reset steps from {b.pkg || sv.name}
            </button>
          )}
        </>
      )}
    </div>
  );
}
