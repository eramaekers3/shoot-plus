// GET /api/stripe?since=<unix seconds | all>   Authorization: Bearer <Supabase session token>
//   → { charges: [...], seen, oldest }  successful Stripe payments since then, newest first
//   (since=all reads your whole Stripe history, up to 3,000 payments)
//
// Read-only. The Stripe key lives only in Vercel's environment variables and never reaches the app.
// Only the account whose email matches STRIPE_OWNER_EMAIL can ask, because anyone can make an account
// in the shared Supabase project.
//
// Vercel environment variables:
//   STRIPE_SECRET_KEY     a restricted key (rk_live_…) with Read on Charges, Checkout Sessions and Balance
//   STRIPE_OWNER_EMAIL    the email you sign in to shoot+ with
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   (already set for the app)
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

async function stripe(path, params) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data.error && data.error.message) || `Stripe error ${res.status}`), { status: res.status });
  return data;
}

/** Every page of a Stripe list, up to `max` items. */
async function all(path, params, max = 300) {
  const out = [];
  let after = null;
  while (out.length < max) {
    const page = await stripe(path, [...params, ['limit', '100'], ...(after ? [['starting_after', after]] : [])]);
    out.push(...page.data);
    if (!page.has_more || !page.data.length) break;
    after = page.data.at(-1).id;
  }
  return out;
}

const METHOD = { card_present: 'Tap to Pay', interac_present: 'Tap to Pay', link: 'Link', cashapp: 'Cash App', us_bank_account: 'Bank' };
function methodOf(c) {
  const d = c.payment_method_details || {};
  if (METHOD[d.type]) return METHOD[d.type];
  if (d.type === 'card' && d.card && d.card.wallet) return d.card.wallet.type === 'apple_pay' ? 'Apple Pay' : d.card.wallet.type === 'google_pay' ? 'Google Pay' : 'Card';
  return 'Card';
}

export async function handle({ token, since }, send) {
  if (!process.env.STRIPE_SECRET_KEY) return send(503, { error: 'Stripe isn’t set up yet. Add STRIPE_SECRET_KEY in Vercel (see the README).' });
  if (!process.env.STRIPE_OWNER_EMAIL) return send(503, { error: 'Add STRIPE_OWNER_EMAIL in Vercel so only you can read your payments.' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return send(503, { error: 'The server is missing the Supabase URL and key.' });
  if (!token) return send(401, { error: 'Sign in to connect Stripe.' });
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(token);
  const user = !error && data && data.user;
  if (!user) return send(401, { error: 'Your sign-in expired. Sign in again in Settings.' });
  if (String(user.email).toLowerCase() !== String(process.env.STRIPE_OWNER_EMAIL).trim().toLowerCase()) {
    return send(403, { error: 'This Stripe account belongs to a different shoot+ account.' });
  }

  const everything = since === 'all';
  const from = everything ? 0 : Math.max(0, Math.floor(Number(since) || Date.now() / 1000 - 90 * 86400));
  try {
    const charges = await all('charges', [['created[gte]', String(from)], ['expand[]', 'data.balance_transaction']], everything ? 3000 : 300);
    // Payment links and website checkout: what was bought and who bought it.
    let sessions = [];
    try {
      sessions = await all('checkout/sessions', [['created[gte]', String(Math.max(0, from - 86400))], ['status', 'complete'], ['expand[]', 'data.line_items']], everything ? 3000 : 300);
    } catch {
      sessions = await all('checkout/sessions', [['created[gte]', String(Math.max(0, from - 86400))], ['status', 'complete']], everything ? 3000 : 300).catch(() => []);
    }
    const byIntent = new Map(sessions.filter((s) => s.payment_intent).map((s) => [s.payment_intent, s]));

    const out = charges
      .filter((c) => c.status === 'succeeded' && c.paid)
      .map((c) => {
        const s = byIntent.get(c.payment_intent) || null;
        const bt = c.balance_transaction && typeof c.balance_transaction === 'object' ? c.balance_transaction : null;
        const items = s && s.line_items && s.line_items.data ? s.line_items.data.map((li) => li.description).filter(Boolean) : [];
        const who = (s && s.customer_details) || {};
        return {
          id: c.id,
          created: c.created,
          amount: c.amount / 100,
          refunded: c.amount_refunded / 100,
          fee: bt ? bt.fee / 100 : null,
          net: bt ? bt.net / 100 : null,
          currency: c.currency,
          name: who.name || (c.billing_details && c.billing_details.name) || '',
          email: who.email || (c.billing_details && c.billing_details.email) || c.receipt_email || '',
          what: items.join(', ') || c.description || '',
          via: s ? (s.payment_link ? 'Payment link' : 'Website checkout') : methodOf(c) === 'Tap to Pay' ? 'Tap to Pay' : 'Stripe',
          method: methodOf(c),
          receipt: c.receipt_url || '',
        };
      });
    const oldest = charges.length ? Math.min(...charges.map((c) => c.created)) : null;
    // What Stripe sent back (no amounts or names), so a check can be followed in Vercel's logs.
    console.log(`stripe check: since=${everything ? 'all' : new Date(from * 1000).toISOString().slice(0, 10)} seen=${charges.length} paid=${out.length} oldest=${oldest ? new Date(oldest * 1000).toISOString().slice(0, 10) : '-'}`);
    return send(200, { charges: out, seen: charges.length, oldest });
  } catch (e) {
    const msg = e.status === 401 ? 'Stripe didn’t accept the key. Check STRIPE_SECRET_KEY in Vercel.'
      : e.status === 403 ? `The Stripe key can’t read everything it needs: ${e.message}`
      : e.message;
    return send(502, { error: msg });
  }
}

export default async function handler(req, res) {
  const send = (status, body) => res.status(status).json(body);
  if (req.method !== 'GET') return send(405, { error: 'Use GET.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return handle({ token, since: req.query.since }, send);
}
