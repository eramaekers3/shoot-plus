# shoot+

The income tracker for your photo and video business, built in the same style as lifestyle+
(same dark grainy look, springy motion, haptics, accent color, logo color and heading font choices).
Installed from Safari to the Home Screen, like lifestyle+.

- **Home** — what you've earned this month, the year so far against your goal, coming-up shoots, recent bookings and taxes.
- **Bookings** — every booking ever, grouped by month, with search and year/service filters. Tap one to edit anything about it.
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

Use a **new** Supabase project so shoot+ stays separate from lifestyle+.

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste `supabase/schema.sql`, press **Run**. Then do the same with
   `supabase/history.sql` (undo history; it uses pg_cron, which you can turn on under Database → Extensions).
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
4. Copy `.env.example` to `.env` and paste the two values in. Restart `npm run dev`.
5. Open **Settings** (top right) and create an account. To skip the confirmation email, turn off
   **Authentication → Providers → Email → Confirm email**.

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
src/
  App.jsx                    tabs, header, + button, which sheet is open
  store.js                   local storage + Supabase sync + sign in (from lifestyle+)
  seed.js                    sample data
  lib/biz.js                 profit, tax set-aside, totals and stats
  lib/logo.js                the glass camera + plus mark (header, loading screen, icons)
  views/                     Home, Bookings, Stats, Clients, Pricing
  components/NewBooking.jsx  the stepped add sheet
  components/BookingSheet.jsx  edit every detail of a booking
  components/Charts.jsx      month bars, year-vs-year line, split bars
  styles.css                 lifestyle+ styles plus shoot+ pieces at the end
```

The tax set-aside is an estimate from the rate you choose, not tax advice.
