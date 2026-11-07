// Sample data so every screen has something in it on first open. It stays on this device and is
// removed when you tap "Clear it" or sign in.
import { putMany, SETTINGS_ID, DEFAULT_SETTINGS } from './store.js';
import { idFor } from './lib/ids.js';
import { addDays, todayISO } from './lib/dates.js';

const SERVICES = [
  {
    key: 'portrait', name: 'Portrait session', kind: 'photo', color: '#ffcf5c', unit: 'flat', price: 175, hours: 1,
    includes: '1 hour, 1 location, 25+ edited photos, online gallery',
    packages: [
      { name: 'Mini', price: 95, hours: 0.5, includes: '30 min, 10 edited photos' },
      { name: 'Standard', price: 175, hours: 1, includes: '1 hour, 25+ edited photos' },
      { name: 'Extended', price: 275, hours: 2, includes: '2 hours, 2 locations, 50+ edited photos' },
    ],
  },
  {
    key: 'senior', name: 'Senior photos', kind: 'photo', color: '#ff8f7a', unit: 'flat', price: 225, hours: 1.5,
    includes: '90 min, 2 outfits, 2 locations, 40+ edited photos',
    packages: [
      { name: 'Classic', price: 225, hours: 1.5, includes: '2 outfits, 40+ photos' },
      { name: 'Signature', price: 325, hours: 2.5, includes: '4 outfits, 3 locations, 70+ photos' },
    ],
  },
  { key: 'couples', name: 'Couples & engagement', kind: 'photo', color: '#ff86b8', unit: 'flat', price: 250, hours: 1.5, includes: '90 min, 40+ edited photos', packages: [] },
  { key: 'headshot', name: 'Headshots', kind: 'photo', color: '#7cc4ff', unit: 'flat', price: 85, hours: 0.5, includes: '30 min, 3 retouched headshots', packages: [{ name: 'Team (per person)', price: 60, hours: 0.25, includes: '1 retouched headshot each' }] },
  { key: 'event', name: 'Event coverage', kind: 'photo', color: '#bba9ff', unit: 'hour', price: 100, hours: 2, includes: '2 hour minimum, edited gallery in a week', packages: [] },
  {
    key: 'promo', name: 'Promo video', kind: 'video', color: '#7fdca0', unit: 'flat', price: 450, hours: 3,
    includes: '60–90 sec edited video, licensed music, 1 round of changes',
    packages: [
      { name: 'Social cut', price: 250, hours: 2, includes: '30 sec vertical video' },
      { name: 'Full promo', price: 450, hours: 3, includes: '60–90 sec video + vertical cut' },
    ],
  },
  { key: 'eventvid', name: 'Event video', kind: 'video', color: '#e8e4d8', unit: 'hour', price: 125, hours: 3, includes: 'Highlight video, 2 hour minimum', packages: [] },
];
const ADDONS = [
  { name: 'Rush delivery (48 hrs)', price: 50 },
  { name: 'Extra location', price: 40 },
  { name: 'Extra edited photo', price: 8 },
];

const CLIENTS = [
  ['Maya Robinson', '@maya.rob'], ['Jordan Ellis', ''], ['Haymarket Coffee Co.', '@haymarketcoffee'], ['Priya Shah', ''], ['Tyler & Brooke', '@tylerandbrooke'],
  ['Sam Ortega', ''], ['Lincoln Running Club', '@lnkrunclub'], ['Avery Nguyen', '@averyn'], ['Chris Howell', ''], ['Delta Phi chapter', ''],
  ['Grace Kim', ''], ['Northside Realty', ''], ['Olivia Park', '@oliviapark'], ['Ben Carter', ''],
];
const PLACES = ['Sunken Gardens', 'Pioneers Park', 'Haymarket', 'UNL City Campus', 'Holmes Lake', 'Studio', 'Downtown Lincoln', 'Wilderness Park', 'Antelope Park'];
const METHODS = ['Venmo', 'Venmo', 'Venmo', 'Cash', 'Zelle', 'Card'];

// A little random number source that gives the same sample every time.
function rng(seed) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

export function seed() {
  const rand = rng(42);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const items = [];
  const svc = SERVICES.map((s, i) => {
    const id = idFor(`sample-service-${s.key}`);
    const { key: _k, packages, ...rest } = s;
    items.push(['service', {
      ...rest, id, order: i, sample: true,
      packages: packages.map((p, j) => ({ ...p, id: idFor(`sample-pkg-${s.key}-${j}`) })),
      addons: ADDONS.map((a, j) => ({ ...a, id: idFor(`sample-addon-${s.key}-${j}`) })),
    }]);
    return { ...s, id };
  });
  const cl = CLIENTS.map(([name, handle], i) => {
    const id = idFor(`sample-client-${i}`);
    items.push(['client', { id, name, handle, sample: true, createdAt: Date.now() }]);
    return id;
  });

  // About two years of bookings, busier in spring (seniors) and fall (events).
  const today = todayISO();
  let n = 0;
  for (let d = -680; d <= 24; d += 3 + Math.floor(rand() * 9)) {
    const date = addDays(today, d);
    const month = +date.slice(5, 7);
    const busy = [4, 5, 9, 10].includes(month) ? 0.85 : [6, 7, 8].includes(month) ? 0.6 : 0.45;
    if (rand() > busy) continue;
    const s = month >= 3 && month <= 5 && rand() < 0.45 ? svc[1] : pick(svc);
    const p = s.packages.length ? pick(s.packages) : null;
    const hours = s.unit === 'hour' ? 2 + Math.floor(rand() * 3) : p ? p.hours : s.hours;
    const price = s.unit === 'hour' ? s.price * hours : p ? p.price : s.price;
    const expenses = [];
    if (s.kind === 'video' && rand() < 0.5) expenses.push({ id: idFor(`sx${n}a`), cat: 'rental', label: 'Gimbal rental', amount: 35 });
    if (s.key === 'event' && rand() < 0.3) expenses.push({ id: idFor(`sx${n}b`), cat: 'second', label: 'Second shooter', amount: 80 });
    if (rand() < 0.2) expenses.push({ id: idFor(`sx${n}c`), cat: 'travel', label: 'Parking', amount: 8 });
    items.push(['booking', {
      id: idFor(`sample-booking-${n++}`),
      sample: true,
      date,
      time: `${pick(['09', '10', '15', '16', '17', '18'])}:${pick(['00', '30'])}`,
      hours,
      serviceId: s.id,
      pkg: p ? p.name : '',
      clientId: pick(cl),
      location: pick(PLACES),
      price,
      tip: rand() < 0.25 ? pick([10, 20, 25, 40]) : 0,
      method: pick(METHODS),
      miles: Math.round(rand() * 22),
      expenses,
      notes: '',
      cancelled: d < 0 && rand() < 0.04,
    }]);
  }

  // Business expenses: a lens, subscriptions and insurance.
  [
    { key: 'lens', date: addDays(today, -200), cat: 'gear', label: 'Sigma 24-70 f/2.8 DG DN Art II', amount: 1299, repeat: '' },
    { key: 'cards', date: addDays(today, -90), cat: 'gear', label: 'Memory cards', amount: 64, repeat: '' },
    { key: 'adobe', date: addDays(today, -500), cat: 'software', label: 'Adobe Photography plan', amount: 19.99, repeat: 'monthly' },
    { key: 'pixieset', date: addDays(today, -400), cat: 'software', label: 'Gallery hosting', amount: 8, repeat: 'monthly' },
    { key: 'ins', date: addDays(today, -300), cat: 'insurance', label: 'Gear insurance', amount: 240, repeat: 'yearly' },
  ].forEach(({ key, ...e }) => items.push(['expense', { ...e, id: idFor(`sample-expense-${key}`), until: '', notes: '', sample: true }]));

  // Estimated tax payments sent in this year.
  const y = +today.slice(0, 4);
  [[`${y}-04-14`, 310], [`${y}-06-13`, 280], [`${y}-09-12`, 340]].forEach(([date, amount], i) => {
    if (date <= today) items.push(['taxpay', { id: idFor(`sample-tax-${i}`), date, amount, note: `Q${i + 1} estimate`, sample: true }]);
  });

  // Two Stripe payments waiting on Home, so you can see how that works.
  [
    { chargeId: 'ch_sample_1', days: -1, amount: 225, fee: 6.83, name: 'Maya Robinson', what: 'Senior photos — Classic', via: 'Payment link', method: 'Apple Pay' },
    { chargeId: 'ch_sample_2', days: 0, amount: 95, fee: 2.85, name: '', what: '', via: 'Tap to Pay', method: 'Tap to Pay' },
  ].forEach((p) => {
    const date = addDays(today, p.days);
    const { days: _d, ...rest } = p;
    items.push(['stripe', {
      ...rest, id: idFor(`stripe:${p.chargeId}`), sample: true, date, created: Math.floor(new Date(`${date}T12:00:00`).getTime() / 1000),
      refunded: 0, net: Math.round((p.amount - p.fee) * 100) / 100, email: '', receipt: '', status: 'new', bookingId: '',
    }]);
  });

  items.push(['settings', { ...DEFAULT_SETTINGS, id: SETTINGS_ID, sample: true, yearGoal: 12000 }]);
  putMany(items);
}
