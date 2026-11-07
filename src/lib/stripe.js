// Stripe payments, pulled in read-only through api/stripe.js.
//
// Each payment becomes a `stripe` record (it syncs to your other devices like everything else):
//   { chargeId, date, created, amount, refunded, fee, net, name, email, what, via, method, receipt,
//     status: 'new' | 'linked' | 'ignored', bookingId }
// New ones wait on Home until you add them as a booking, attach them to one you already logged, or ignore them.

import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../supabase.js';
import { get, list, put, putMany, patch, useKind, useSyncStatus, saveSettings, SETTINGS_ID } from '../store.js';
import { idFor, newId } from './ids.js';
import { iso, parse, todayISO } from './dates.js';
import { norm } from './text.js';
import { toast } from './toast.js';
import { num, saveBooking, clientFor } from './biz.js';

const LAST = 'shootplus.stripeChecked';
const RESULT = 'shootplus.stripeResult'; // what the last check found, so it survives closing the app
const EVERY = 20 * 60 * 1000; // check at most every 20 minutes on its own

let state = { syncing: false, error: '', notSetUp: false, lastSync: readLast(), found: null, ...readResult() };
const listeners = new Set();
const set = (changes) => {
  state = { ...state, ...changes };
  listeners.forEach((l) => l());
};
function readResult() {
  try {
    const r = JSON.parse(localStorage.getItem(RESULT) || 'null');
    return r ? { error: r.error || '', notSetUp: !!r.notSetUp, found: r.found ?? null } : {};
  } catch {
    return {};
  }
}
function saveResult() {
  try {
    localStorage.setItem(RESULT, JSON.stringify({ error: state.error, notSetUp: state.notSetUp, found: state.found }));
  } catch {
    /* storage unavailable */
  }
}
function readLast() {
  try {
    return Number(localStorage.getItem(LAST)) || 0;
  } catch {
    return 0;
  }
}

export function useStripeStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );
}

export const recId = (chargeId) => idFor(`stripe:${chargeId}`);
export const useStripe = () => useKind('stripe');

/** Asks the server for payments since the newest one we have, and saves any new ones. */
export async function syncStripe(force = false, { days, everything } = {}) {
  if (!supabase || state.syncing) return;
  // Check right away when nothing has come in yet or the last check failed; otherwise at most every 20 minutes.
  const settled = list('stripe').some((r) => !r.sample) && !state.error;
  if (!force && settled && Date.now() - state.lastSync < EVERY) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session && data.session.access_token;
  if (!token) return;
  set({ syncing: true });
  try {
    const have = list('stripe').filter((r) => !r.sample);
    const newest = have.reduce((m, r) => Math.max(m, r.created || 0), 0);
    const since = everything ? 'all' : days ? Math.floor(Date.now() / 1000 - days * 86400) : newest ? newest - 3 * 86400 : '';
    const res = await fetch(`/api/stripe${since ? `?since=${since}` : ''}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.status === 503 || res.status === 404) {
      set({ syncing: false, notSetUp: true, error: res.status === 404 ? 'The Stripe server function isn’t deployed yet.' : body.error });
      saveResult();
      if (force) toast(state.error);
      return;
    }
    if (!res.ok) throw new Error(body.error || `Couldn’t reach Stripe (${res.status}).`);
    const items = [];
    let fresh = 0;
    for (const c of body.charges || []) {
      const id = recId(c.id);
      const old = get(id);
      const data = {
        id, chargeId: c.id, created: c.created, date: iso(new Date(c.created * 1000)),
        amount: c.amount, refunded: c.refunded, fee: c.fee, net: c.net, name: c.name, email: c.email,
        what: c.what, via: c.via, method: c.method, receipt: c.receipt,
      };
      if (!old) {
        // Fully refunded payments skip the New list.
        const status = c.refunded >= c.amount ? 'ignored' : 'new';
        items.push(['stripe', { ...data, status, bookingId: '' }]);
        if (status === 'new') fresh++;
      } else if (old.refunded !== c.refunded || old.fee !== c.fee) {
        items.push(['stripe', { ...old, refunded: c.refunded, fee: c.fee, net: c.net }]);
      }
    }
    if (items.length) putMany(items);
    // With auto-add on, payments whose service is known become bookings right away.
    const auto = (get(SETTINGS_ID) || {}).stripeAuto ? autoAdd(items.filter(([, d]) => d.status === 'new').map(([, d]) => d)) : 0;
    fresh -= auto;
    const now = Date.now();
    try {
      localStorage.setItem(LAST, String(now));
    } catch {
      /* storage unavailable */
    }
    set({ syncing: false, notSetUp: false, error: '', lastSync: now, found: (body.charges || []).length });
    saveResult();
    if (force) {
      const n = (body.charges || []).length;
      const back = body.oldest ? ` (back to ${new Date(body.oldest * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })})` : '';
      toast(
        auto
          ? `${auto} booking${auto === 1 ? '' : 's'} added from Stripe${fresh ? `, ${fresh} to sort` : ''}${back}`
          : fresh
          ? `${fresh} new Stripe payment${fresh === 1 ? '' : 's'}${back}`
          : n
            ? `Stripe sent ${n} payment${n === 1 ? '' : 's'}${back}, all already here`
            : 'Stripe sent back no payments for that stretch'
      );
    }
  } catch (e) {
    set({ syncing: false, error: e.message || String(e) });
    saveResult();
    if (force) toast(e.message || 'Couldn’t reach Stripe');
  }
}

/** Checks Stripe when the app opens or comes back to the front, while you're signed in. */
export function useStripeSync() {
  const sync = useSyncStatus();
  const signedIn = !!sync.email;
  useEffect(() => {
    if (!signedIn) return;
    syncStripe();
    const onVis = () => document.visibilityState === 'visible' && syncStripe();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [signedIn]);
}

/* ---------- What to do with a payment ---------- */

const kept = (p) => num(p.amount) - num(p.refunded);

function ensureMethod() {
  const s = get(SETTINGS_ID) || {};
  const methods = s.methods || [];
  if (!methods.includes('Stripe')) saveSettings({ methods: [...methods, 'Stripe'] });
}

const feeLine = (p) => (p.fee ? [{ id: newId(), cat: 'fees', label: 'Stripe fee', amount: p.fee }] : []);

/* ---------- Which service a payment was for ---------- */

// What a payment's description is remembered under: "Senior Photos – Classic (x1)" → "senior photos classic".
const keyOf = (what) => norm(what).replace(/\(x\d+\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const words = (t) => keyOf(t).split(' ').filter((w) => w.length > 1);

/**
 * Best guess at the service (and package) a payment was for, or null.
 *   1. what you picked before for a payment with the same description (learned)
 *   2. the description names one of your services or packages
 *   3. the amount is exactly one package's or service's price (only when just one matches)
 * `sure` is false for a price-only match, so auto-add leaves those for you to check.
 */
export function guessService(services, p) {
  const learned = ((get(SETTINGS_ID) || {}).stripeMap || {})[keyOf(p.what)];
  if (learned && services.some((s) => s.id === learned.serviceId)) return { ...learned, sure: true, why: 'learned' };
  const what = words(p.what);
  if (what.length) {
    let best = null;
    for (const s of services) {
      const sw = words(s.name);
      const hits = sw.filter((w) => what.includes(w) || what.includes(w.replace(/s$/, ''))).length;
      if (!hits || hits < Math.min(sw.length, 2)) continue;
      const pkg = (s.packages || []).find((pk) => pk.name && words(pk.name).every((w) => what.includes(w)));
      const score = hits / sw.length + (pkg ? 1 : 0);
      if (!best || score > best.score) best = { score, serviceId: s.id, pkg: pkg ? pkg.name : '', hours: pkg ? pkg.hours : s.hours };
    }
    if (best) return { serviceId: best.serviceId, pkg: best.pkg, hours: best.hours, sure: true, why: 'name' };
  }
  const amount = kept(p);
  let hits = [];
  for (const s of services) {
    // One hit per service: a matching package beats the service's own price.
    const pk = (s.packages || []).filter((x) => Math.abs(num(x.price) - amount) < 0.01);
    if (pk.length === 1) hits.push({ serviceId: s.id, pkg: pk[0].name, hours: pk[0].hours });
    else if (pk.length > 1 || (s.unit !== 'hour' && Math.abs(num(s.price) - amount) < 0.01)) hits.push({ serviceId: s.id, pkg: '', hours: s.hours });
  }
  // A price shared by several services: a partial name match ("Senior session") picks between them.
  if (hits.length > 1 && what.length) {
    const named = hits.filter((h) => words(services.find((s) => s.id === h.serviceId).name).some((w) => what.includes(w)));
    if (named.length === 1) return { ...named[0], sure: true, why: 'name' };
  }
  return hits.length === 1 ? { ...hits[0], sure: false, why: 'price' } : null;
}

/** Remembers which service a payment description goes with, so the next one fills itself in. */
export function learn(stripeId, serviceId, pkg = '') {
  const p = stripeId && get(stripeId);
  if (!p || !p.what || !serviceId) return;
  const map = { ...((get(SETTINGS_ID) || {}).stripeMap || {}) };
  const k = keyOf(p.what);
  if (map[k] && map[k].serviceId === serviceId && map[k].pkg === pkg) return;
  map[k] = { serviceId, pkg };
  saveSettings({ stripeMap: map });
}

/** Turns payments into bookings when their service is known for sure. Returns how many. */
function autoAdd(ps) {
  const services = list('service');
  const biz = { clients: list('client') };
  const ok = ps.filter((p) => {
    const g = guessService(services, p);
    return g && g.sure;
  });
  if (ok.length) addAllAsBookings(biz, ok, { quiet: true, services });
  return ok.length;
}

/** What a new booking made from this payment starts with. */
export function presetFrom(p, services = list('service')) {
  ensureMethod();
  const g = guessService(services, p);
  return {
    ...(g ? { serviceId: g.serviceId, pkg: g.pkg, hours: g.hours ?? '' } : {}),
    price: kept(p),
    date: p.date,
    method: 'Stripe',
    expenses: feeLine(p),
    notes: [p.what, p.via].filter(Boolean).join(' · '),
    newClientName: p.name || '',
    stripeId: p.id,
  };
}

/** Attaches a payment to a booking you already logged: marks it paid by Stripe and adds the fee. */
export function linkTo(p, b) {
  ensureMethod();
  const expenses = (b.expenses || []).filter((e) => e.label !== 'Stripe fee');
  put('booking', { ...b, method: 'Stripe', stripeId: p.id, expenses: [...expenses, ...feeLine(p)], updatedAt: Date.now() });
  patch(p.id, { status: 'linked', bookingId: b.id });
  toast('Payment attached');
}

export function markLinked(stripeId, bookingId) {
  if (stripeId && get(stripeId)) patch(stripeId, { status: 'linked', bookingId });
}

export function ignore(p) {
  patch(p.id, { status: 'ignored' });
  toast('Payment hidden', { label: 'Undo', run: () => patch(p.id, { status: 'new' }) });
}

/** Hides every payment still waiting (for example, older ones you've already logged by hand). */
export function ignoreAll(ps) {
  ps.forEach((p) => patch(p.id, { status: 'ignored' }));
  toast(`${ps.length} payments hidden`, { label: 'Undo', run: () => ps.forEach((p) => patch(p.id, { status: 'new' })) });
}

export function unhide(ps) {
  ps.forEach((p) => patch(p.id, { status: 'new' }));
  toast(ps.length === 1 ? 'Payment back on Home' : `${ps.length} payments back on Home`);
}

/** Turns payments straight into bookings (price, date, payer as client, Stripe fee as an expense). */
export function addAllAsBookings(biz, ps, { quiet = false, services = list('service') } = {}) {
  let named = 0;
  // Payers seen earlier in this batch, so two payments from the same person make one client.
  const made_clients = new Map();
  const clientOf = (name) => {
    const k = norm(name);
    if (!k) return '';
    if (!made_clients.has(k)) made_clients.set(k, clientFor(biz, name));
    return made_clients.get(k);
  };
  const made = ps.map((p) => {
    const { newClientName, stripeId, ...preset } = presetFrom(p, services);
    if (preset.serviceId) named++;
    const b = saveBooking({
      serviceId: '', pkg: '', title: preset.serviceId ? '' : p.what || '', time: '', hours: '', location: '', tip: '', miles: '',
      ...preset, clientId: clientOf(newClientName), stripeId, createdAt: Date.now(),
    });
    patch(p.id, { status: 'linked', bookingId: b.id });
    return b;
  });
  if (!quiet) {
    const n = made.length;
    toast(`${n} booking${n === 1 ? '' : 's'} added from Stripe${named < n ? ` — ${n - named} need${n - named === 1 ? 's' : ''} a service` : ''}`);
  }
  return made;
}

/** Stripe bookings with no service yet: fills in the ones it can work out. Returns how many it filled. */
export function fillServices(biz) {
  let n = 0;
  for (const b of biz.all) {
    if (!b.stripeId || b.serviceId) continue;
    const p = get(b.stripeId);
    const g = p && guessService(biz.services, p);
    if (!g) continue;
    const { $: _m, ...rest } = b;
    put('booking', { ...rest, serviceId: g.serviceId, pkg: g.pkg, hours: rest.hours || g.hours || '', title: rest.title === p.what ? '' : rest.title, updatedAt: Date.now() });
    n++;
  }
  toast(n ? `Filled in the service on ${n} booking${n === 1 ? '' : 's'}` : 'Couldn’t work out any more services. Pick them on each booking and it’ll learn.');
  return n;
}

/** Takes a payment off a booking (the booking stays; the payment goes back to New). */
export function unlink(b) {
  const p = b.stripeId && get(b.stripeId);
  put('booking', { ...b, stripeId: '', expenses: (b.expenses || []).filter((e) => e.label !== 'Stripe fee'), updatedAt: Date.now() });
  if (p) patch(p.id, { status: 'new', bookingId: '' });
}

/** Bookings this payment probably belongs to: close in date, not already paid by Stripe, similar price or name. */
export function matchesFor(biz, p) {
  const day = parse(p.date).getTime();
  const name = norm(p.name);
  return biz.live
    .filter((b) => !b.stripeId)
    .map((b) => {
      const days = Math.abs(parse(b.date).getTime() - day) / 864e5;
      if (days > 21) return null;
      const cname = norm(biz.clientById[b.clientId] ? biz.clientById[b.clientId].name : '');
      let score = 10 - days / 2;
      if (Math.abs(b.$.gross - kept(p)) < 1 || Math.abs(b.$.price - kept(p)) < 1) score += 12;
      if (name && cname && (cname.includes(name.split(' ')[0]) || name.includes(cname.split(' ')[0]))) score += 10;
      return { b, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.b);
}

export const isToday = (p) => p.date === todayISO();
