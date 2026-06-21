# CalendarInsights

Turn your Google Calendar into a picture of where your time actually goes.
CalendarInsights syncs your calendar events, categorizes them with rules you
control, and produces time-spent reports (week / month / year / custom),
period-over-period **insights** ("movers"), and a daily **timeline** — including
time that never makes it onto a calendar (sleep, focus work) via manual blocks.

---

## What it does

- **Google sign-in + calendar sync.** Log in with Google, grant read-only
  Calendar access, and the app pulls your events into its own database using
  incremental sync tokens (only fetches what changed).
- **Hybrid categorization.** Rules map events to categories by calendar id,
  contained title text, or regex. The highest-`priority` rule wins. A category
  you set by hand is never overwritten by a rule.
- **Time reports.** Distribution of time per category across selectable periods
  and groupings, timezone-aware so days/weeks bucket correctly.
- **Insights / movers.** Compare a period against the previous one to see which
  categories grew or shrank. Ignore noisy activities straight from the view.
- **Daily timeline.** Hour-by-hour view of a single day.
- **Manual blocks.** Model recurring time that isn't on the calendar (sleep,
  work) so reports reflect a full day, optionally filling only the gaps between
  real events.
- **Ignored titles.** Hide specific events from every report, by exact title or
  contained text.
- **All-day handling.** All-day events (holidays, birthdays) are excluded from
  time-spent reports by default — they would otherwise inflate totals ~10×.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| UI | **React 19**, **Tailwind CSS v4**, **Recharts** |
| Language | **TypeScript** |
| Auth | **Auth.js v5** (`next-auth` beta) — Google OAuth, database sessions |
| ORM / DB | **Drizzle ORM** + **PostgreSQL** (`postgres-js` driver) |
| Validation | **Zod** |
| Dates | **date-fns** / **date-fns-tz** |
| Hosting | **Vercel** (Postgres on Vercel Postgres / Neon) |

> ⚠️ **This is a forked Next.js 16 with breaking convention changes.** The
> middleware file is **`proxy.ts`** (not `middleware.ts`), `cookies()` / `params`
> / `searchParams` are async, and Turbopack is the default bundler. When in
> doubt, read `node_modules/next/dist/docs/` rather than relying on prior
> Next.js knowledge.

---

## Architecture

```
src/
  auth.ts                  Auth.js v5 config (Google, Calendar scope, refresh token, DB sessions)
  proxy.ts                 Optimistic /dashboard gate (session-cookie presence only)
  db/
    schema.ts              Auth tables + categories, calendars, events, rules,
                           ignoredTitles, manualBlockTemplates
    index.ts               Drizzle client (postgres-js)
  lib/
    google/client.ts       Refreshes the Google access_token from the stored refresh_token
    google/sync.ts         Incremental sync (syncToken) → upsert events
    categorize.ts          Applies rules (hybrid: auto rule + manual override)
    reports.ts             Period/grouping aggregation + insights (timezone-aware)
    manual.ts              Manual-block expansion into the timeline
    format.ts              Display helpers
  scripts/                 seed / inspect / clear-oauth (run with tsx)
  app/
    lib/dal.ts             verifySession() — real auth check next to the data
    lib/actions.ts         Server actions (rules, settings, ignore, manual blocks)
    login/page.tsx         Google login
    api/auth/[...nextauth] Auth.js handlers
    api/sync/route.ts      POST = sync current user · GET = cron (all users)
    (app)/dashboard/       Reports (server) + ReportView / InsightsView / SyncButton (client)
    (app)/dashboard/rules/         Rule management
    (app)/dashboard/settings/      Timezone, all-day toggle, auto-sync
    (app)/dashboard/day/           Daily timeline
```

### Auth model

- Google OAuth with `access_type=offline` + `prompt=consent` to obtain a
  **refresh token**, required for background cron syncs.
- Scope: `openid email profile calendar.readonly`.
- **Database sessions** via the Drizzle adapter. Auth table column names must
  match the `@auth/drizzle-adapter` Postgres defaults.
- `allowDangerousEmailAccountLinking` is safe here because Google is the only
  provider and the email is Google-verified.
- Two-layer protection: `proxy.ts` does a cheap cookie-presence check to avoid a
  DB hit per request; `dal.ts#verifySession()` does the real verification close
  to the data.

### Sync model

`lib/google/sync.ts` uses Google's incremental `syncToken` per calendar. First
run is a full pull; later runs fetch only changes. Events are upserted on
`(calendarId, googleEventId)`. A daily Vercel cron hits `GET /api/sync` to keep
every user current.

---

## Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Vercel Postgres / Neon, `sslmode=require`) |
| `AUTH_SECRET` | yes | Auth.js encryption key — `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | yes | Google OAuth client id |
| `AUTH_GOOGLE_SECRET` | yes | Google OAuth client secret |
| `CRON_SECRET` | no | Authorizes `GET /api/sync` (Vercel cron) |
| `DEV_USER_ID` | no | Dev-only auth bypass (non-production) |

### Google Cloud Console

1. Enable the **Google Calendar API**.
2. Create an **OAuth client ID** of type *Web application*.
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (local)
   - `https://<your-domain>/api/auth/callback/google` (production)
4. Paste the client id / secret into `.env.local`.

---

## Local setup

Requires **Node 22 LTS** (`package.json` engines: `^20.19 || ^22.13 || >=24`).

```bash
npm install                # install deps

npm run db:generate        # generate SQL migrations from src/db/schema.ts
npm run db:migrate         # apply them   (or: npm run db:push in dev)

npm run dev                # start dev server (Turbopack)
```

Open http://localhost:3000 → redirects to `/login` → **Sign in with Google**
(consent must request Calendar access) → on `/dashboard` press **Sync**.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (dev) |
| `npm run db:studio` | Drizzle Studio (inspect data) |
| `npm run seed` | Seed sample data (`tsx`, uses `.env.local`) |

---

## CI/CD & deploy

- **Host:** Vercel. Push to the connected branch → Vercel builds with
  `npm run build` (Turbopack) and deploys. Preview deployments per PR/branch.
- **Environment:** set the variables above in Vercel project settings for
  Production and Preview. Add the production redirect URI in Google Cloud.
- **Database:** Vercel Postgres or Neon. Run `npm run db:migrate` against the
  production `DATABASE_URL` when the schema changes.
- **Cron:** `vercel.json` schedules a daily background sync:

  ```json
  {
    "crons": [{ "path": "/api/sync", "schedule": "0 9 * * *" }]
  }
  ```

  The cron calls `GET /api/sync`, which iterates all users and refreshes their
  events. Protect it with `CRON_SECRET`.
- **Linting:** `npm run lint` (ESLint + `eslint-config-next`). No standalone test
  suite yet.

---

## Data model (summary)

`user` (timezone, all-day preference) · `account` / `session` /
`verificationToken` (Auth.js) · `category` · `calendar` (per-calendar
`syncToken`, selected flag) · `event` (UTC times, duration, category +
`categorySource`, raw payload) · `rule` (matchType: calendar / title_contains /
title_regex, priority) · `ignored_title` (exact / contains) ·
`manual_block_template` (kind, days of week, start/end, gap-fill).
