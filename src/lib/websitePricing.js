// Prices from ethanramaekers.com and its booking page (read November 7, 2026). Pricing → "Update from ethanramaekers.com"
// copies them into your services: a service you already have (matched by name) keeps its color, hours
// and bookings and gets the website's price, packages and details; anything missing is added.
// When the website changes, update this list and bump VERSION so the card offers the update again.
import { put, saveSettings, get, list, remove, SETTINGS_ID } from '../store.js';
import { idFor } from './ids.js';
import { norm } from './text.js';
import { toast } from './toast.js';
import { SERVICE_COLORS } from './biz.js';

export const VERSION = '2026-11-07c';
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
      { name: 'Package 3', price: 600, hours: 2, includes: '5 outfits, 4 locations' },
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
    key: 'couples',
    match: ['couple', 'engagement', 'proposal'],
    name: 'Couples & engagement',
    kind: 'photo',
    color: '#ff86b8',
    unit: 'flat',
    price: 200,
    hours: 0.75,
    includes: 'Couples, engagement and proposal shoots.',
    packages: [
      { name: 'One Location', price: 200, hours: 0.75, includes: 'Couples/engagement shoot, 45 minutes' },
      { name: 'Two Locations', price: 300, hours: 0.75, includes: 'Couples/engagement shoot, 45 minutes' },
      { name: 'Proposal Basic', price: 225, hours: 0.75, includes: 'Proposal shoot, 45 minutes' },
      { name: 'Proposal Premium', price: 300, hours: 1.25, includes: 'Proposal shoot, 1 hour 15 minutes' },
    ],
    addons: [],
    notes: '',
    page: '/couples',
  },
  {
    key: 'family',
    match: ['family', 'group'],
    name: 'Family & group sessions',
    kind: 'photo',
    color: '#ffcf5c',
    unit: 'flat',
    price: 225,
    hours: 0.5,
    includes: 'Base price is for 6 people or fewer; add-ons cover bigger groups.',
    packages: [
      { name: 'One Location', price: 225, hours: 0.5, includes: '30 minutes, up to 6 people' },
      { name: 'Two Locations', price: 325, hours: 1, includes: '1 hour, up to 6 people' },
    ],
    addons: [
      { name: '6–10 total people (+10 min)', price: 50 },
      { name: '11–15 total people (+15 min)', price: 75 },
      { name: '16+ total people (+20 min)', price: 100 },
    ],
    notes: '',
    page: '/groups',
  },
  {
    key: 'realestate',
    match: ['real estate', 'drone'],
    name: 'Real estate',
    kind: 'photo',
    color: '#7fdca0',
    unit: 'flat',
    price: 150,
    includes: 'Interior and exterior HDR photos, color-corrected and brightened. Drone by a commercially certified pilot (DJI Mini 3 Pro, 4K).',
    packages: [
      { name: 'Interior/Exterior Photos', price: 150, includes: 'Interior and exterior HDR photos' },
      { name: 'Drone Photos', price: 100, includes: 'Drone photos only' },
      { name: 'Drone Photos and Videos', price: 150, includes: 'Drone photos and 4K video' },
      { name: 'Interior/Exterior and Drone Photos', price: 225, includes: 'HDR photos plus drone photos' },
      { name: 'Interior/Exterior and Drone Photos and Videos', price: 270, includes: 'HDR photos plus drone photos and video' },
    ],
    addons: [],
    notes: '',
    page: '/real-estate',
  },
];

/** Services an earlier version of this list added that you've since dropped: removed if no booking uses them. */
const DROPPED = ['sportsphotos'];

/** Listed on the website without prices (shown so you know to fill them in yourself). */
export const NO_PRICE_ON_SITE = [];

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
        hours: data.hours ?? '',
        packages: keepIds(data.packages).map((p) => ({ hours: '', ...p })),
        addons: keepIds(data.addons),
        order: services.length + i,
      });
      added++;
    }
  });
  let removed = 0;
  for (const key of DROPPED) {
    const id = idFor(`web-service-${key}`);
    if (get(id) && !list('booking').some((b) => b.serviceId === id)) {
      remove(id);
      removed++;
    }
  }
  saveSettings({ websitePricing: VERSION });
  toast(`Prices from your website: ${[updated && `${updated} updated`, added && `${added} added`, removed && `${removed} removed`].filter(Boolean).join(', ')}`);
}

export const isApplied = () => ((get(SETTINGS_ID) || {}).websitePricing || '') >= VERSION;
