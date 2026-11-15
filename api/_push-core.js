// Decides which shoot+ reminders are due right now. No database or network here, so it can be
// tested on its own; api/push-tick.js gathers the data and does the sending.

// Defaults for Settings → Notifications. Times are minutes after midnight.
export const DEFAULT_NOTIFY = {
  eve: true, // the evening before a shoot
  eveAt: 19 * 60,
  lead: true, // an hour before it starts
  gallery: true, // galleries due tomorrow, today, or a day late
  galleryAt: 9 * 60,
  taxes: true, // a week and a day before quarterly estimated taxes are due
};
const LEAD = 60;
// Quarterly estimated tax due dates (month, day), federal and Nebraska.
const TAX_DATES = [[1, 15], [4, 15], [6, 15], [9, 15]];
export const QUEUE_START = '2026-10-01'; // same as src/lib/biz.js

const GRACE = 4;
const isDue = (nowMin, target) => nowMin - target >= 0 && nowMin - target < GRACE;
const pad = (n) => String(n).padStart(2, '0');
export const minLabel = (m) => {
  let h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return mm ? `${h}:${pad(mm)} ${ap}` : `${h} ${ap}`;
};
export const addDays = (s, n) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? +m[1] * 60 + +m[2] : null;
};
const longDate = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function localParts(d, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}

/** "Senior photos · Maya R." */
export function nameOf(b, services, clients) {
  const sv = services[b.serviceId];
  const what = b.title || [sv ? sv.name : 'Shoot', b.pkg].filter(Boolean).join(' — ');
  const who = b.clientId && clients[b.clientId] ? clients[b.clientId].name : '';
  return [what, who].filter(Boolean).join(' · ');
}

/** The gallery due date: set on the booking, or the shoot date plus the service's (or your) turnaround. */
export function dueOf(b, services, settings) {
  if (b.due) return b.due;
  const sv = services[b.serviceId];
  const days = Number(sv && sv.turnaround) || Number(settings.turnaround) || 7;
  return addDays(b.date, days);
}

/**
 * Returns [{ key, title, body, url }] for reminders due at `now`.
 *   bookings: live (not cancelled) bookings; services, clients: by id; settings: shoot+ settings
 */
export function dueNotifications({ now, tz, settings = {}, bookings = [], services = {}, clients = {} }) {
  const n = { ...DEFAULT_NOTIFY, ...(settings.notify || {}) };
  const { date, min } = localParts(now, tz);
  const tomorrow = addDays(date, 1);
  const out = [];
  const live = bookings.filter((b) => !b.cancelled && b.date);
  const when = (b) => {
    const t = toMin(b.time);
    return t == null ? '' : minLabel(t);
  };

  // 1. The evening before: tomorrow's shoots.
  if (n.eve && isDue(min, n.eveAt)) {
    const next = live.filter((b) => b.date === tomorrow).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (next.length) {
      const lines = next.map((b) => [when(b), nameOf(b, services, clients), b.location].filter(Boolean).join(' · '));
      out.push({
        key: `eve:${date}`,
        title: next.length === 1 ? 'Shoot tomorrow' : `${next.length} shoots tomorrow`,
        body: lines.join('\n') + '\nCharge batteries, clear cards.',
        url: '/#bookings',
      });
    }
  }

  // 2. An hour before each shoot that has a start time.
  if (n.lead) {
    for (const b of live.filter((x) => x.date === date)) {
      const t = toMin(b.time);
      if (t == null || !isDue(min, t - LEAD)) continue;
      out.push({
        key: `lead:${b.id}:${b.date}:${b.time}`,
        title: `Shoot at ${minLabel(t)}: ${nameOf(b, services, clients)}`,
        body: b.location ? `${b.location} · leave with time to spare.` : 'In an hour.',
        url: '/#bookings',
      });
    }
  }

  // 3. Galleries: due tomorrow, due today, or a day late. Shoots before the edit queue started don't count.
  if (n.gallery && isDue(min, n.galleryAt)) {
    const editing = live.filter((b) => !b.delivered && b.date <= date && !(b.date < QUEUE_START && !b.due));
    const groups = { today: [], tomorrow: [], late: [] };
    for (const b of editing) {
      const due = dueOf(b, services, settings);
      if (due === date) groups.today.push(b);
      else if (due === tomorrow) groups.tomorrow.push(b);
      else if (due === addDays(date, -1)) groups.late.push(b);
    }
    const names = (list) => list.map((b) => nameOf(b, services, clients)).join(', ');
    const bits = [];
    if (groups.late.length) bits.push(`Late: ${names(groups.late)}`);
    if (groups.today.length) bits.push(`Due today: ${names(groups.today)}`);
    if (groups.tomorrow.length) bits.push(`Due tomorrow: ${names(groups.tomorrow)}`);
    if (bits.length) {
      const total = groups.late.length + groups.today.length + groups.tomorrow.length;
      out.push({
        key: `gal:${date}`,
        title: groups.late.length ? 'A gallery is past due' : total === 1 ? 'Gallery due soon' : `${total} galleries due soon`,
        body: bits.join('. ') + '.',
        url: '/#home',
      });
    }
  }

  // 4. Quarterly estimated taxes: a week before and the day before, in the morning.
  if (n.taxes && isDue(min, 9 * 60)) {
    const y = +date.slice(0, 4);
    for (const [m, d] of TAX_DATES) {
      for (const yr of [y, y + 1]) {
        const dueDate = `${yr}-${pad(m)}-${pad(d)}`;
        const days = dueDate === addDays(date, 7) ? 7 : dueDate === tomorrow ? 1 : 0;
        if (!days) continue;
        out.push({
          key: `tax:${dueDate}:${days}`,
          title: days === 1 ? 'Estimated taxes due tomorrow' : 'Estimated taxes due in a week',
          body: `${longDate(dueDate)} (or the next business day). Your set-aside is on the Stats tab; log the payment there once it’s sent.`,
          url: '/#stats',
        });
      }
    }
  }

  return out;
}
