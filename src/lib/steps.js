// The steps of a shoot: the work between booking it and being completely done, checked off one at a
// time. A new booking's steps come from what its service or package includes (its description), so a
// Full Team Media Day gets the poster, the buttons and the videos, and a portrait session just gets
// shoot → edit → deliver. Each booking's list can be edited on its own.
//
// step { id, label, done, tag }   tag: 'shoot' | 'deliver' | 'final' | '' (marks the steps the app acts on)

import { put } from '../store.js';
import { newId } from './ids.js';
import { todayISO } from './dates.js';
import { haptic } from './haptics.js';
import { cheer } from './cheer.js';
import { toast } from './toast.js';

const has = (text, re) => re.test(text);

/** The step labels a service (and package, when one is picked) calls for, in the order they happen. */
export function stepLabels(service, pkgName) {
  const sv = service || {};
  const pkg = (sv.packages || []).find((p) => p.name === pkgName);
  // A package describes exactly what's in it; without one, go by the service as a whole.
  const text = (pkg ? `${pkg.name} ${pkg.includes || ''}` : `${sv.name || ''} ${sv.includes || ''}`).toLowerCase();
  const all = `${text} ${(sv.includes || '').toLowerCase()} ${(sv.name || '').toLowerCase()}`;
  const video = sv.kind === 'video';
  const out = [{ label: 'Shoot', tag: 'shoot' }];
  if (!video && has(all, /preview/)) out.push({ label: 'Send preview photos' });
  if (video) out.push({ label: 'Edit video' });
  else out.push({ label: has(text, /\bhdr\b/) ? 'Edit HDR photos' : 'Edit photos' });
  if (has(text, /poster/)) out.push({ label: 'Build poster' });
  if (has(text, /button/)) out.push({ label: 'Build button template' }, { label: 'Buttons designed' }, { label: 'Buttons made' });
  if (!video && has(text, /video|film|reel|media day/)) out.push({ label: 'Videos made' });
  out.push({ label: video ? 'Video delivered' : 'Gallery delivered', tag: 'deliver' });
  out.push({ label: 'Everything finished', tag: 'final' });
  return out;
}

/** Fresh steps for a booking. A shoot that already happened starts with "Shoot" checked. */
export function stepsFor(service, pkgName, date, idBase = '') {
  const today = todayISO();
  return stepLabels(service, pkgName).map((x, i) => ({ id: idBase ? `${idBase}-step${i}` : newId(), label: x.label, tag: x.tag || '', done: x.tag === 'shoot' && !!date && date <= today }));
}

/** A booking's steps: its own, or (for bookings from before steps) ones worked out from its service. */
export function stepsOf(biz, b) {
  if (b.steps && b.steps.length) return b.steps;
  const sv = biz.serviceById[b.serviceId];
  // Ids come from the booking's id, so the same list comes back every time until it's saved.
  const steps = stepsFor(sv, b.pkg, b.date, b.id);
  // Delivered before steps existed: all done.
  return b.delivered ? steps.map((x) => ({ ...x, done: true })) : steps;
}

/** True when nothing but "Shoot" has been checked, so the list can follow a change of service. */
export const untouched = (steps) => !steps || steps.every((x) => !x.done || x.tag === 'shoot');

export const progress = (steps) => ({ done: steps.filter((x) => x.done).length, total: steps.length, next: steps.find((x) => !x.done) || null });

const clean = (b) => {
  const { $: _m, ...rest } = b;
  return rest;
};

/** Saves a new list of steps, keeping the gallery's delivered date and the finished date in line with it. */
export function saveSteps(b, steps, { quiet = false } = {}) {
  const rest = clean(b);
  const today = todayISO();
  let next = steps;
  const final = next.find((x) => x.tag === 'final');
  // Checking "Everything finished" finishes everything; unchecking anything un-finishes it.
  if (final && final.done && next.some((x) => !x.done)) next = next.map((x) => ({ ...x, done: true }));
  const allDone = next.length > 0 && next.every((x) => x.done);
  if (!allDone && final && final.done) next = next.map((x) => (x.tag === 'final' ? { ...x, done: false } : x));
  const deliver = next.find((x) => x.tag === 'deliver');
  let delivered = rest.delivered || '';
  if (deliver) delivered = deliver.done ? delivered || today : '';
  else if (allDone) delivered = delivered || today;
  const out = { ...rest, steps: next, delivered, finished: allDone ? rest.finished || today : '', updatedAt: Date.now() };
  put('booking', out);
  if (!quiet && allDone && !rest.finished) toast('Shoot finished', { label: 'Undo', run: () => put('booking', { ...rest, updatedAt: Date.now() }) });
  return out;
}

/** Checks or unchecks one step. el (optional) gets a little celebration. */
export function toggleStep(biz, b, stepId, el) {
  const steps = stepsOf(biz, b).map((x) => (x.id === stepId ? { ...x, done: !x.done } : x));
  const step = steps.find((x) => x.id === stepId);
  const out = saveSteps(b, steps);
  if (step && step.done) {
    haptic(out.finished ? 'success' : 'tick');
    if (el && out.finished) cheer(el, { text: 'All done' });
    else if (el && step.tag === 'deliver') cheer(el, { text: 'Delivered' });
  } else haptic('tick');
  return out;
}

/** Checks the next step that isn't done. */
export function checkNext(biz, b, el) {
  const n = progress(stepsOf(biz, b)).next;
  if (n) toggleStep(biz, b, n.id, el);
}

export const newStep = (label) => ({ id: newId(), label, tag: '', done: false });
