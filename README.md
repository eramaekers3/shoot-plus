# shoot+

The income tracker for your photo and video business, built in the same style as lifestyle+
(same dark grainy look, springy motion, haptics, accent color, logo color and heading font choices).
Installed from Safari to the Home Screen, like lifestyle+.

- **Home** — what you've earned this month, new Stripe payments, galleries still to edit (with due dates), the year so far
  against your goal, coming-up shoots, recent bookings and taxes.
- **Bookings** — every booking ever, grouped by month, with search and year/service filters. Tap one to edit anything about it,
  including its gallery due date, link and when you delivered it. Switch to **Business expenses** for gear, software,
  insurance and other costs not tied to one shoot (one-time, monthly or yearly); they lower profit and the tax set-aside.
- **Stats** — by month, against last year, by service, top and repeat clients, expenses, weekdays and locations, payment methods, quarterly taxes and records. Pick any year or all time.
- **Clients** — everyone you've shot, what they've paid, contact info and their bookings.
- **Pricing** — your services with packages and add-ons, plus a quick quote calculator.
- **+ button** — add a booking one step at a time: what, when & where, who, money.

Each booking has a price, tip, how it was paid, miles driven, expenses (gear rental, second shooter,
travel…), and notes. Profit and the tax set-aside are worked out from your rates in Settings → Business.
Settings also has undo history, a backup file, restoring a backup, and a spreadsheet export.

## Run it on your computer

```bash
npm install
npm run dev
```

It starts with sample data. Tap **Clear it** at the top to start fresh.

## Set up the database (Supabase)

shoot+ lives in the **same Supabase project as lifestyle+**, in its own tables (`shoot_records` and
`shoot_record_history`), so the two apps never see or change each other's data. Your sign-in is shared:
the same email and password work in both.

1. In the lifestyle+ Supabase project, open **SQL Editor → New query**, paste `supabase/shoot-plus.sql`, press **Run**.
2. **Project Settings → API**: copy the **Project URL** and the **anon public** key (the same ones lifestyle+ uses).
3. Copy `.env.example` to `.env` and paste the two values in. Restart `npm run dev`.
4. Open **Settings** (top right) and sign in with your lifestyle+ account.

## Connect Stripe (read-only)

Payments from Stripe payment links, Tap to Pay and your website checkout show up on Home under
**New from Stripe**. Tap one to add it as a booking (price, date, payer's name and the Stripe fee are
filled in) or attach it to a booking you already logged. shoot+ can only read Stripe; it can't charge,
refund or move money. The key stays on the server (`api/stripe.js`); the app never sees it.

1. In Stripe, go to **Developers → API keys → Create restricted key**. Name it `shoot+` and set
   **Charges**, **Checkout Sessions** and **Balance** to **Read**. Leave everything else as None.
2. In Vercel → shoot-plus → **Settings → Environment Variables**, add:
   - `STRIPE_SECRET_KEY` — the `rk_live_…` key
   - `STRIPE_OWNER_EMAIL` — the email you sign in to shoot+ with (only that account can read your payments,
     since anyone can make an account in the shared Supabase project)
3. Redeploy, then open **Settings → Stripe → Check Stripe now**. A payment's service is worked out from what was
   paid for (your service and package names), what you picked before for the same description, or an exact price.
   Turn on **Add payments as bookings automatically** to skip the New list when the service is clear.
    The first check pulls in the last 90 days;
   after that it checks when you open the app (at most every 20 minutes). **Hide all** clears ones you've
   already logged by hand.

To try it with `npm run dev`, put the same two values in `.env` (never as `VITE_` variables).

## Put it on your iPhone

1. Make a new GitHub repo (for example `shoot-plus`) and push this folder to it.
2. At [vercel.com](https://vercel.com), import the repo. It detects Vite.
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy.
4. Open the site in **Safari** → **Share → Add to Home Screen**.

Long-press the Home Screen icon for **New booking** and **Stats** shortcuts. Sign in again inside the installed app.

## How the data works

Same as lifestyle+: every booking, client, service and tax payment is one row in a `records` table.
Changes save on the phone first (works offline), then sync. Newer edits win. Row Level Security means only
your account can read your rows.

## Project map

```
api/stripe.js                reads your Stripe payments (Vercel server function)
src/
  App.jsx                    tabs, header, + button, which sheet is open
  store.js                   local storage + Supabase sync + sign in (from lifestyle+)
  seed.js                    sample data
  lib/biz.js                 profit, tax set-aside, totals and stats
  lib/stripe.js              pulling in Stripe payments and matching them to bookings
  lib/logo.js                the glass camera + plus mark (header, loading screen, icons)
  views/                     Home, Bookings, Stats, Clients, Pricing
  components/NewBooking.jsx  the stepped add sheet
  components/BookingSheet.jsx  edit every detail of a booking
  components/Charts.jsx      month bars, year-vs-year line, split bars
  styles.css                 lifestyle+ styles plus shoot+ pieces at the end
```

The tax set-aside is an estimate from the rate you choose, not tax advice.
