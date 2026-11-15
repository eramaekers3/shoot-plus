// POST /api/push-tick
// Called once a minute by a Supabase cron job (see supabase/push.sql). Works out which shoot+
// reminders are due for each person with shoot+ notifications on, and sends them.
//   Header: Authorization: Bearer <CRON_SECRET>
import { fromCron, hasDb, hasPushKeys, serverDb, sendOnce, subsByUser } from './_server.js';
import { DEFAULT_NOTIFY, dueNotifications, localParts, addDays } from './_push-core.js';

const TABLE = 'shoot_records';

async function forUser(db, userId, subs, now) {
  const tz = subs[0].tz || 'America/Chicago';
  const { date } = localParts(now, tz);
  const mine = (kind) => db.from(TABLE).select('id, data').eq('user_id', userId).eq('kind', kind).eq('deleted', false);
  const [settingsQ, bookingsQ, servicesQ, clientsQ] = await Promise.all([
    mine('settings').limit(1),
    // Recent and upcoming shoots: enough for tomorrow's shoots and galleries due in the next day.
    mine('booking').gte('data->>date', addDays(date, -120)).lte('data->>date', addDays(date, 1)),
    mine('service'),
    mine('client'),
  ]);
  const byId = (q) => Object.fromEntries((q.data || []).map((r) => [r.id, { ...(r.data || {}), id: r.id }]));
  const settings = ((settingsQ.data || [])[0] || {}).data || {};
  const notes = dueNotifications({
    now,
    tz,
    settings: { ...settings, notify: { ...DEFAULT_NOTIFY, ...(settings.notify || {}) } },
    bookings: Object.values(byId(bookingsQ)),
    services: byId(servicesQ),
    clients: byId(clientsQ),
  });
  let sent = 0;
  for (const note of notes) sent += await sendOnce(db, userId, subs, note);
  return sent;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!fromCron(req)) return res.status(401).json({ error: 'Not allowed.' });
  if (!hasDb() || !hasPushKeys()) return res.status(500).json({ error: 'The server is missing its Supabase or push keys.' });
  const db = serverDb();
  const now = new Date();
  let byUser;
  try {
    byUser = await subsByUser(db);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  let sent = 0;
  for (const [userId, list] of byUser) {
    try {
      sent += await forUser(db, userId, list, now);
    } catch (e) {
      console.log('shoot push tick failed for a user', e.message);
    }
  }
  res.status(200).json({ users: byUser.size, sent });
}
