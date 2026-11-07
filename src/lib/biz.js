// The business rules: what a booking earns, costs and sets aside for taxes, and the numbers the
// Home and Stats pages are built from.
//
// Records (one row each in the `records` table):
//   booking  { date, time, hours, serviceId, pkg, title, clientId, location, price, tip, method,
//              expenses: [{ id, cat, label, amount }], miles, notes, cancelled,
//              due, delivered, gallery }   due: gallery due date (blank = shoot + turnaround); delivered: date sent
//   client   { name, phone, email, handle, notes }
//   service  { name, color, kind, unit: 'flat' | 'hour', price, hours, includes, packages: [...], addons: [...], notes, order }
//   taxpay   { date, amount, note }      money you actually sent in for taxes
//   expense  { date, cat, label, amount, repeat: '' | 'monthly' | 'yearly', until, notes }
//            business costs not tied to one shoot (gear, software, insurance…); repeating ones count each time

import { useMemo } from 'react';
import { useKind, useSettings, put, remove, get } from '../store.js';
import { todayISO, addDays, parse, iso } from './dates.js';
import { norm } from './text.js';
import { toast } from './toast.js';

/* ---------- Money ---------- */

const whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $1,250 — or $12.50 when there are cents (only under $1,000; bigger totals round to the dollar). */
export const money = (v) => {
  const n = Number(v) || 0;
  return Math.abs(n) < 1000 && Math.abs(n - Math.round(n)) > 0.004 ? cents.format(n) : whole.format(n);
};
/** $1.2k for chart labels. */
export const short = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 10000) return `$${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${Math.round(n)}`;
};
export const num = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/* ---------- Expense kinds ---------- */

export const EXPENSE_CATS = [
  { id: 'rental', name: 'Gear rental', c: '#7cc4ff' },
  { id: 'second', name: 'Second shooter', c: '#bba9ff' },
  { id: 'travel', name: 'Travel & parking', c: '#ff9f4a' },
  { id: 'supplies', name: 'Props & supplies', c: '#ff86b8' },
  { id: 'editing', name: 'Editing help', c: '#7fdca0' },
  { id: 'fees', name: 'Fees', c: '#ffcf5c' },
  { id: 'other', name: 'Other', c: '#b6b4ad' },
];
export const MILEAGE = { id: 'miles', name: 'Mileage', c: '#ff8f7a' };
export const catOf = (id) => (id === 'miles' ? MILEAGE : EXPENSE_CATS.find((c) => c.id === id) || EXPENSE_CATS.at(-1));

// Business costs that aren't part of one shoot.
export const OVERHEAD_CATS = [
  { id: 'gear', name: 'Gear', c: '#7cc4ff' },
  { id: 'software', name: 'Software & subscriptions', c: '#bba9ff' },
  { id: 'insurance', name: 'Insurance', c: '#7fdca0' },
  { id: 'marketing', name: 'Website & marketing', c: '#ff86b8' },
  { id: 'education', name: 'Education', c: '#ffcf5c' },
  { id: 'phone', name: 'Phone & internet', c: '#ff9f4a' },
  { id: 'otherbiz', name: 'Other', c: '#b6b4ad' },
];
export const overheadCat = (id) => OVERHEAD_CATS.find((c) => c.id === id) || OVERHEAD_CATS.at(-1);

export const SERVICE_COLORS = ['#ffcf5c', '#ff9f4a', '#ff8f7a', '#ff86b8', '#bba9ff', '#7cc4ff', '#7fdca0', '#e8e4d8'];

/* ---------- One booking ---------- */

/** Everything a booking adds up to, given your tax rate and mileage rate. */
export function calc(b, s) {
  const price = num(b.price);
  const tip = num(b.tip);
  const gross = price + tip;
  const listed = (b.expenses || []).reduce((t, e) => t + num(e.amount), 0);
  const mileage = num(b.miles) * num(s.mileRate);
  const costs = listed + mileage;
  const profit = gross - costs;
  const tax = Math.max(0, profit) * (num(s.taxRate) / 100);
  return { price, tip, gross, listed, mileage, costs, profit, tax, keep: profit - tax };
}

export const isUpcoming = (b, today = todayISO()) => b.date > today;

/* ---------- Reading everything ---------- */

const byDateDesc = (a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''));

export function useBiz() {
  const s = useSettings();
  const bookings = useKind('booking');
  const clients = useKind('client');
  const services = useKind('service');
  const taxpays = useKind('taxpay');
  const expenses = useKind('expense');
  return useMemo(() => {
    const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
    const serviceById = Object.fromEntries(services.map((x) => [x.id, x]));
    const all = bookings
      .map((b) => ({ ...b, $: calc(b, s) }))
      .sort(byDateDesc);
    return {
      s,
      all,
      live: all.filter((b) => !b.cancelled),
      clients: [...clients].sort((a, b) => norm(a.name).localeCompare(norm(b.name))),
      services: [...services].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || norm(a.name).localeCompare(norm(b.name))),
      taxpays: [...taxpays].sort((a, b) => b.date.localeCompare(a.date)),
      expenses: [...expenses].sort((a, b) => b.date.localeCompare(a.date)),
      clientById,
      serviceById,
    };
  }, [s, bookings, clients, services, taxpays, expenses]);
}

export const clientName = (biz, id) => (id && biz.clientById[id] ? biz.clientById[id].name : '');
export const serviceOf = (biz, id) => (id && biz.serviceById[id]) || null;
export const colorOf = (biz, b) => (serviceOf(biz, b.serviceId) || {}).color || 'var(--muted)';

/** "Senior session · Maya R." — what a booking is called in lists. */
export function titleOf(biz, b) {
  if (b.title) return b.title;
  const sv = serviceOf(biz, b.serviceId);
  return [sv ? sv.name : 'Booking', b.pkg].filter(Boolean).join(' — ');
}

/* ---------- Totals ---------- */

export function sum(list) {
  const t = { n: 0, gross: 0, tip: 0, costs: 0, mileage: 0, profit: 0, tax: 0, keep: 0, hours: 0, miles: 0 };
  for (const b of list) {
    t.n++;
    t.gross += b.$.gross;
    t.tip += b.$.tip;
    t.costs += b.$.costs;
    t.mileage += b.$.mileage;
    t.profit += b.$.profit;
    t.tax += b.$.tax;
    t.keep += b.$.keep;
    t.hours += num(b.hours);
    t.miles += num(b.miles);
  }
  t.avg = t.n ? t.gross / t.n : 0;
  return t;
}

export const inYear = (list, y) => (y === 'all' ? list : list.filter((b) => b.date.startsWith(String(y))));
export const inMonth = (list, ym) => list.filter((b) => b.date.startsWith(ym));
/** Done: on or before today. */
export const done = (list, today = todayISO()) => list.filter((b) => b.date <= today);
export const ahead = (list, today = todayISO()) => list.filter((b) => b.date > today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

export const years = (biz) => {
  const ys = new Set(biz.live.map((b) => +b.date.slice(0, 4)));
  ys.add(new Date().getFullYear());
  return [...ys].sort((a, b) => b - a);
};

/** Twelve months of totals for a year. */
export function byMonth(list, y) {
  return Array.from({ length: 12 }, (_, m) => {
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
    return { ym, m, ...sum(inMonth(list, ym)) };
  });
}

/** Running total of income through the year, one point per day-of-year that had a booking. */
export function cumulative(list, y, upTo = '9999') {
  const pts = [{ d: 0, v: 0 }];
  let v = 0;
  const start = parse(`${y}-01-01`);
  for (const b of [...inYear(list, y)].filter((b) => b.date <= upTo).sort((a, b) => a.date.localeCompare(b.date))) {
    v += b.$.gross;
    pts.push({ d: Math.round((parse(b.date) - start) / 864e5), v });
  }
  return pts;
}

/** Income grouped by something (service, client, weekday…), biggest first. */
export function groupBy(list, keyOf) {
  const m = new Map();
  for (const b of list) {
    const k = keyOf(b);
    if (k == null) continue;
    const g = m.get(k) || { key: k, list: [] };
    g.list.push(b);
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, ...sum(g.list) })).sort((a, b) => b.gross - a.gross);
}

/** Every expense in a set of bookings, by kind (mileage included). */
export function expensesByCat(list) {
  const m = new Map();
  const add = (cat, v) => v && m.set(cat, (m.get(cat) || 0) + v);
  for (const b of list) {
    for (const e of b.expenses || []) add(e.cat || 'other', num(e.amount));
    add('miles', b.$.mileage);
  }
  return [...m.entries()].map(([id, v]) => ({ ...catOf(id), v })).sort((a, b) => b.v - a.v);
}

/* ---------- Editing and delivery ---------- */

// Shoots before this date count as delivered unless you say otherwise, so years of past bookings
// don't land in the queue the day it appears.
export const QUEUE_START = '2026-10-01';

/** Days to deliver a booking's gallery: its service's turnaround, or the one in Settings. */
export const turnaroundOf = (biz, b) => {
  const sv = serviceOf(biz, b.serviceId);
  return num(sv && sv.turnaround) || num(biz.s.turnaround) || 7;
};
export const dueOf = (biz, b) => b.due || addDays(b.date, turnaroundOf(biz, b));

/** Where a booking is: 'upcoming', 'editing', or 'delivered'. */
export function stageOf(b, today = todayISO()) {
  if (b.delivered) return 'delivered';
  if (b.date > today) return 'upcoming';
  if (b.date < QUEUE_START && !b.due) return 'delivered';
  return 'editing';
}

/** Shoots waiting to be edited and delivered, soonest due first. */
export function editQueue(biz) {
  const today = todayISO();
  return biz.live
    .filter((b) => stageOf(b, today) === 'editing')
    .map((b) => {
      const due = dueOf(biz, b);
      const days = Math.round((parse(due) - parse(today)) / 864e5);
      return { b, due, days };
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** How long delivery has taken, on average, for galleries you marked delivered. */
export function avgTurnaround(biz) {
  const list = biz.live.filter((b) => b.delivered && b.delivered >= b.date);
  if (!list.length) return null;
  const days = list.reduce((t, b) => t + (parse(b.delivered) - parse(b.date)) / 864e5, 0) / list.length;
  const onTime = list.filter((b) => b.delivered <= dueOf(biz, b)).length / list.length;
  return { days, onTime, n: list.length };
}

/* ---------- Business expenses (overhead) ---------- */

/**
 * Every time a business expense lands between two dates (inclusive), never past today.
 * A monthly one repeats on the same day each month (the last day for short months), a yearly one each year.
 */
export function occurrences(biz, from = '0000-01-01', to = '9999-12-31') {
  const today = todayISO();
  const end = to < today ? to : today;
  const out = [];
  for (const e of biz.expenses) {
    if (!e.date || e.date > end) continue;
    if (!e.repeat) {
      if (e.date >= from) out.push({ ...e, on: e.date });
      continue;
    }
    const stop = e.until && e.until < end ? e.until : end;
    const [y0, m0, d0] = e.date.split('-').map(Number);
    const step = e.repeat === 'yearly' ? 12 : 1;
    for (let k = 0; k < 600; k++) {
      const mi = m0 - 1 + k * step;
      const y = y0 + Math.floor(mi / 12);
      const m = (mi % 12) + 1;
      const last = new Date(y, m, 0).getDate();
      const on = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d0, last)).padStart(2, '0')}`;
      if (on > stop) break;
      if (on >= from) out.push({ ...e, on });
    }
  }
  return out.sort((a, b) => b.on.localeCompare(a.on));
}

export const overheadSum = (biz, from, to) => occurrences(biz, from, to).reduce((t, o) => t + num(o.amount), 0);

/**
 * Totals for a stretch of time, counting business expenses too: profit is after every cost, and the
 * tax set-aside is your rate on that profit (so gear and software lower it).
 */
export function totals(biz, list, from, to) {
  const t = sum(list);
  const overhead = overheadSum(biz, from, to);
  const profit = t.profit - overhead;
  const tax = Math.max(0, profit) * (num(biz.s.taxRate) / 100);
  return { ...t, shootProfit: t.profit, overhead, allCosts: t.costs + overhead, profit, tax, keep: profit - tax };
}

const lastDay = (ym) => `${ym}-${String(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate()).padStart(2, '0')}`;
export const yearRange = (y) => (y === 'all' ? ['0000-01-01', '9999-12-31'] : [`${y}-01-01`, `${y}-12-31`]);

/** Twelve months for a year, each with business expenses included. */
export function monthsFull(biz, y) {
  return Array.from({ length: 12 }, (_, m) => {
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
    return { ym, m, ...totals(biz, inMonth(biz.live, ym), `${ym}-01`, lastDay(ym)) };
  });
}

/** Business expenses in a stretch, by category. */
export function overheadByCat(biz, from, to) {
  const m = new Map();
  for (const o of occurrences(biz, from, to)) m.set(o.cat, (m.get(o.cat) || 0) + num(o.amount));
  return [...m.entries()].map(([id, v]) => ({ ...overheadCat(id), v })).sort((a, b) => b.v - a.v);
}

/** What a business expense costs per year (repeating ones multiplied out). */
export const perYear = (e) => num(e.amount) * (e.repeat === 'monthly' ? 12 : 1);

/* ---------- Taxes ---------- */

// US estimated-tax deadlines for income earned in each part of the year.
export function quarters(y) {
  return [
    { q: 1, from: `${y}-01-01`, to: `${y}-03-31`, due: `${y}-04-15` },
    { q: 2, from: `${y}-04-01`, to: `${y}-05-31`, due: `${y}-06-15` },
    { q: 3, from: `${y}-06-01`, to: `${y}-08-31`, due: `${y}-09-15` },
    { q: 4, from: `${y}-09-01`, to: `${y}-12-31`, due: `${y + 1}-01-15` },
  ];
}

export function taxYear(biz, y) {
  const list = done(inYear(biz.live, y));
  const setAside = totals(biz, list, `${y}-01-01`, `${y}-12-31`).tax;
  // A payment counts toward the year it's for (January's Q4 payment is last year's), else its own year.
  const paid = biz.taxpays.filter((t) => +(t.forYear || t.date.slice(0, 4)) === +y).reduce((a, t) => a + num(t.amount), 0);
  const qs = quarters(+y).map((q) => ({ ...q, tax: totals(biz, list.filter((b) => b.date >= q.from && b.date <= q.to), q.from, q.to).tax }));
  const today = todayISO();
  const next = qs.find((q) => q.due >= today && q.from <= today) || qs.find((q) => q.due >= today) || null;
  return { setAside, paid, owed: Math.max(0, setAside - paid), quarters: qs, next };
}

/* ---------- Writing ---------- */

export function saveBooking(b) {
  return put('booking', { ...b, updatedAt: Date.now() });
}

/** Deletes something and offers Undo. */
export function removeWithUndo(kind, id, what) {
  const was = get(id);
  if (!was) return;
  remove(id);
  toast(`${what} deleted`, { label: 'Undo', run: () => put(kind, was) });
}

/** Finds a client by name, or makes one. Returns the id. */
export function clientFor(biz, name) {
  const n = norm(name);
  if (!n) return '';
  const hit = biz.clients.find((c) => norm(c.name) === n);
  if (hit) return hit.id;
  return put('client', { name: name.trim(), createdAt: Date.now() }).id;
}

/** Bookings this client has had, newest first, and what they add up to. */
export function clientStats(biz, id) {
  const list = biz.live.filter((b) => b.clientId === id);
  return { list, ...sum(done(list)), first: list.at(-1) && list.at(-1).date, last: list[0] && list[0].date };
}

export const relDate = (d) => {
  const t = todayISO();
  if (d === t) return 'Today';
  if (d === addDays(t, 1)) return 'Tomorrow';
  if (d === addDays(t, -1)) return 'Yesterday';
  const days = Math.round((parse(d) - parse(t)) / 864e5);
  if (days > 0 && days < 7) return `In ${days} days`;
  return null;
};

export const thisYear = () => new Date().getFullYear();
export const thisMonth = () => todayISO().slice(0, 7);
export const prevMonth = (ym) => {
  const d = parse(`${ym}-01`);
  d.setMonth(d.getMonth() - 1);
  return iso(d).slice(0, 7);
};

/* ---------- Export ---------- */

/** A spreadsheet of every booking (opens in Numbers, Excel or Google Sheets). */
export function exportCSV(biz) {
  const head = ['Date', 'Time', 'Service', 'Package', 'Title', 'Client', 'Location', 'Hours', 'Price', 'Tip', 'Paid with', 'Expenses', 'Miles', 'Mileage $', 'Profit', 'Tax set aside', 'Cancelled', 'Notes'];
  const q = (v) => {
    const t = String(v ?? '');
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const rows = biz.all.map((b) => {
    const sv = serviceOf(biz, b.serviceId);
    return [
      b.date, b.time || '', sv ? sv.name : '', b.pkg || '', b.title || '', clientName(biz, b.clientId), b.location || '', b.hours || '',
      b.$.price.toFixed(2), b.$.tip.toFixed(2), b.method || '', b.$.listed.toFixed(2), b.miles || '', b.$.mileage.toFixed(2),
      b.$.profit.toFixed(2), b.$.tax.toFixed(2), b.cancelled ? 'yes' : '', b.notes || '',
    ].map(q).join(',');
  });
  const body = [head.join(','), ...rows].join('\n');
  const name = `shoot-plus-bookings-${todayISO()}.csv`;
  return shareFile(new File([body], name, { type: 'text/csv' }), name);
}

export async function shareFile(file, name) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
