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
import { num } from './biz.js';

const LAST = 'shootplus.stripeChecked';
const EVERY = 20 * 60 * 1000; // check at most every 20 minutes on its own

let state = { syncing: false, error: '', notSetUp: false, lastSync: readLast() };
const listeners = new Set();
const set = (changes) => {
  state = { ...state, ...changes };
  listeners.forEach((l) => l());
};
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
export async function syncStripe(force = false) {
  if (!supabase || state.syncing) return;
  if (!force && Date.now() - state.lastSync < EVERY) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session && data.session.access_token;
  if (!token) return;
  set({ syncing: true, error: '' });
  try {
    const have = list('stripe');
    const newest = have.reduce((m, r) => Math.max(m, r.created || 0), 0);
    const since = newest ? newest - 3 * 86400 : '';
    const res = await fetch(`/api/stripe${since ? `?since=${since}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 503 || res.status === 404) {
      set({ syncing: false, notSetUp: true, error: res.status === 404 ? 'The Stripe server function isn’t deployed yet.' : body.error });
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
    const now = Date.now();
    try {
      localStorage.setItem(LAST, String(now));
    } catch {
      /* storage unavailable */
    }
    set({ syncing: false, notSetUp: false, error: '', lastSync: now });
    if (force) toast(fresh ? `${fresh} new Stripe payment${fresh === 1 ? '' : 's'}` : 'Stripe is up to date');
  } catch (e) {
    set({ syncing: false, error: e.message || String(e) });
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

/** What a new booking made from this payment starts with. */
export function presetFrom(p) {
  ensureMethod();
  return {
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
