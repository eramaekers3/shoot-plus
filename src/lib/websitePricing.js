// Prices from ethanramaekers.com (read November 7, 2026). Pricing → "Update from ethanramaekers.com"
// copies them into your services: a service you already have (matched by name) keeps its color, hours
// and bookings and gets the website's price, packages and details; anything missing is added.
// When the website changes, update this list and bump VERSION so the card offers the update again.
import { put, saveSettings, get, SETTINGS_ID } from '../store.js';
import { idFor } from './ids.js';
import { norm } from './text.js';
import { toast } from './toast.js';
import { SERVICE_COLORS } from './biz.js';

export const VERSION = '2026-11-07';
export const SOURCE = 'https://ethanramaekers.com';

const TRAVEL = 'Travel: $0.67 per mile if more than 100 miles round trip from Lincoln, NE.';

export const WEBSITE_SERVICES = [
  {
    key: 'senior',
    match: ['senior'],
    name: 'Senior photos',
    kind: 'photo',
    color: '#ff8f7a',
    unit: 'flat',
    price: 400,
    turnaround: 14,
    includes: '5–10 preview photos in 1–3 business days; full-resolution edited library in 1–2 weeks.',
    packages: [
      { name: 'Package 1', price: 400, includes: '3 outfits, 2 locations' },
      { name: 'Package 2', price: 500, includes: '4 outfits, 3 locations' },
      { name: 'Package 3', price: 600, includes: '5 outfits, 4 locations' },
    ],
    addons: [],
    notes: 'Reserve at least a week ahead. The gym and football field count as two locations. Indoor sessions any time; outdoor best morning or evening. Payment info collected before the session, charged after.',
    page: '/senior-photos',
  },
  {
    key: 'team',
    match: ['team media', 'team'],
    name: 'Sports team media',
    kind: 'photo',
    color: '#7cc4ff',
    unit: 'flat',
    price: 675,
    includes: 'Team poster, athlete and team photos, and button pictures. Edited content for the season.',
    packages: [
      { name: 'Full Team Media Day', price: 675, includes: 'Team poster, athlete/team photos, button pics' },
      { name: 'Team Poster', price: 300, includes: 'Posed studio shoot, edits, poster design, file delivery' },
      { name: 'Team Photoshoot', price: 250, includes: 'Individual, group and team photos at an outdoor location' },
      { name: 'Button Pictures', price: 75, includes: 'Photoshoot and button design; athletes order buttons online' },
    ],
    addons: [{ name: 'Indoor shoot (setup, tear down, extra equipment)', price: 50 }],
    notes: TRAVEL,
    page: '/sports-team-media',
  },
  {
    key: 'sportsphotos',
    match: ['sports photo', 'photo download', 'photo sales'],
    name: 'Sports photo downloads',
    kind: 'photo',
    color: '#ffcf5c',
    unit: 'flat',
    price: 5,
    includes: 'One game photo, sold through the website.',
    packages: [],
    addons: [],
    notes: 'Priced per photo. Some photos are free.',
    page: '/sportsphotos',
  },
];

/** Listed on the website without prices (shown so you know to fill them in yourself). */
export const NO_PRICE_ON_SITE = ['Family / group sessions', 'Couples sessions'];

const findExisting = (services, w) => services.find((s) => w.match.some((m) => norm(s.name).includes(m)));

/** What pressing the button would do, for the card's summary. */
export function preview(services) {
  return WEBSITE_SERVICES.map((w) => ({ ...w, existing: findExisting(services, w) || null }));
}

export function applyWebsitePricing(services) {
  let updated = 0, added = 0;
  WEBSITE_SERVICES.forEach((w, i) => {
    const { key, match: _m, page: _p, ...data } = w;
    const ex = findExisting(services, w);
    const keepIds = (list, old = []) =>
      list.map((x, j) => ({ ...x, id: (old.find((o) => norm(o.name) === norm(x.name)) || {}).id || idFor(`web-${key}-${j}-${x.name}`) }));
    if (ex) {
      put('service', {
        ...ex,
        price: data.price,
        unit: data.unit,
        includes: data.includes,
        notes: data.notes,
        packages: keepIds(data.packages, ex.packages).map((p) => ({ hours: (ex.packages || []).find((o) => norm(o.name) === norm(p.name))?.hours ?? '', ...p })),
        addons: keepIds(data.addons, ex.addons),
        ...(data.turnaround ? { turnaround: data.turnaround } : {}),
      });
      updated++;
    } else {
      put('service', {
        ...data,
        id: idFor(`web-service-${key}`),
        color: data.color || SERVICE_COLORS[(services.length + i) % SERVICE_COLORS.length],
        hours: '',
        packages: keepIds(data.packages).map((p) => ({ hours: '', ...p })),
        addons: keepIds(data.addons),
        order: services.length + i,
      });
      added++;
    }
  });
  saveSettings({ websitePricing: VERSION });
  toast(`Prices from your website: ${[updated && `${updated} updated`, added && `${added} added`].filter(Boolean).join(', ')}`);
}

export const isApplied = () => ((get(SETTINGS_ID) || {}).websitePricing || '') >= VERSION;
