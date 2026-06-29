<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Note: `middleware.ts` has been renamed to `proxy.ts` and `export function middleware()` is now `export function proxy()`.
<!-- END:nextjs-agent-rules -->

---

# Project: Chalk — Pool Hall Management SaaS

## Tech Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- Supabase (Postgres, Auth, SSR)
- shadcn/ui (radix-nova style, RSC enabled, neutral base, Lucide icons)
- Vercel

---

## Database Schema

```sql
venues (
  id uuid primary key,
  name text,
  timezone text,
  created_at timestamptz
)

users (
  id uuid primary key references auth.users(id),
  venue_id uuid references venues(id),
  name text,
  role text, -- 'owner', 'manager', or 'staff' (legacy; multi-venue membership lives in venue_members)
  created_at timestamptz
)

tables (
  id uuid primary key,
  venue_id uuid references venues(id),
  name text,
  size text,           -- '9ft' or 'bar_box'
  status text,         -- 'free', 'occupied', 'inactive'
  display_order integer
)

rates (
  id uuid primary key,
  venue_id uuid references venues(id),
  label text,
  hourly_rate numeric(10,2),
  is_default boolean
)

sessions (
  id uuid primary key,
  venue_id uuid references venues(id),
  table_id uuid references tables(id),
  rate_id uuid references rates(id),
  staff_id uuid references users(id),
  started_at timestamptz,
  ended_at timestamptz,         -- null means session is active
  actual_rate_charged numeric(10,2),
  notes text,
  player_name text
)
```

---

## Seeded Data (Shy Lounge)
- 1 venue: Shy Lounge
- 2 tables: Table 1, Table 2 (both 9ft)
- 3 rates: League ($15/hr), Non-League ($25/hr), Peak ($25/hr)
- 1 owner account: Vish

---

## Key Conventions

- **Active session** = `sessions` row where `ended_at` is null
- **Always snapshot `actual_rate_charged`** on the session row at start time — never recalculate from the rate table
- **RLS is currently disabled** for development — do not enable without explicit instruction
- **All queries must be scoped to `venue_id`** — a logged-in user belongs to exactly one venue; every table/session/rate/revenue query must be filtered by that venue. Obtain venue_id via `getProfileFromToken(supabase)` inside every server action (reads JWT claims, no DB query)
- **No test suite until v2**

---

## File & Route Structure

```
src/
  proxy.ts                        — Middleware entry point (renamed from middleware.ts)
  app/
    page.tsx                      — Redirects / → /login
    layout.tsx                    — Root layout: DM Sans + Exo 2 fonts, dark theme
    globals.css                   — OKLCH color system, dark theme, success utilities
    login/
      page.tsx                    — Login page (animated wave background)
      functions.tsx               — Login form (client, useActionState)
      actions.ts                  — loginAction, logoutAction (server actions)
    dashboard/
      page.tsx                    — Dashboard (client component, full state management)
      actions.ts                  — All data loading + session CRUD (server actions)
  components/
    dashboard/
      header.tsx                  — Fixed header: venue name, stat chips, logout, summary button
      table-card.tsx              — Table card: free state, occupied state (live timer + amount)
      start-session-modal.tsx     — Start session form (player name + rate selector)
      end-session-modal.tsx       — End session summary (confirms close)
      summary-drawer.tsx          — Owner-only drawer: today's completed sessions + total
      pool-ball.tsx               — SVG pool ball (1–15, solid/striped, used for table number)
    login/
      light-waves.tsx             — Animated SVG wave background (login page)
    ui/                           — shadcn primitives: button, input, label, sheet, card
    icons/                        — Custom SVG icons: avatar, lock
  hooks/                          — (empty — use-device-type.ts removed, header uses Tailwind responsive classes)
  lib/
    pool-types.ts                 — Domain interfaces + billing logic (calculateAmountOwed, etc.)
    utils.ts                      — cn() = clsx + tailwind-merge
  utils/supabase/
    server.ts                     — createClient() for Server Actions (cookie-based SSR)
    client.ts                     — createClient() for browser components
    middleware.ts                 — updateSession() — validates auth, syncs cookies, redirects
```

---

## Server Actions (`src/app/dashboard/actions.ts`)

All actions authenticate the user and retrieve their `venue_id` before any query. Never skip this.

### `loadDashboardData()`
Returns `{ tables, rates, userRole, todayRevenue, todayCompletedSessionsCount }`.
- Fetches tables (status != 'inactive', ordered by display_order)
- Fetches active sessions filtered by venue table IDs
- Fetches rates for venue
- Calls `loadTodaySummaryForVenue()` for revenue stats

### `loadTodaySessions()`
Returns `TodaySession[]` for the owner's summary drawer. Delegates to `loadTodaySummaryForVenue()`.

### `startSessionAction(tableId, rateId, playerName?)`
- Validates `tableId` belongs to user's venue
- Validates `rateId` belongs to user's venue
- Snapshots `hourly_rate` → `actual_rate_charged` at insert time
- Inserts session row; updates table status to `'occupied'`

### `endSessionAction(tableId)`
- Validates `tableId` belongs to user's venue
- Sets `ended_at = now()` on the active session
- Updates table status to `'free'`

### `getProfileFromToken(supabase)` (internal)
Returns `{ venueId, role, userId }` by reading `app_metadata` claims from the local JWT — no DB query. Requires the `custom_access_token_hook` Postgres function to be registered in Supabase (see README). Throws if `venue_id` or `role` are missing from the token (hook not configured).

### `loadTodaySummaryForVenue(supabase, profile)` (internal)
Calculates revenue for the current business day (3am–3am local time). Uses `todayBoundsUTC()` to convert the venue's timezone to UTC bounds.

---

## Auth & Routing

- `src/proxy.ts` runs on every request (except static assets)
- `updateSession()` in `src/utils/supabase/middleware.ts`:
  - Uses `getUser()` (validates with Supabase auth server) for redirect decisions — intentional, keeps route protection secure
  - Redirects `/dashboard` → `/login` if unauthenticated
  - Redirects `/login` → `/dashboard` if already authenticated
- Server-side Supabase client (`server.ts`) reads/writes auth cookies via Next.js `cookies()` API
- Browser client (`client.ts`) is for client components that need Supabase (currently none do queries — all queries go through Server Actions)

## JWT Claims Hook

`venue_id` and `role` are baked into the JWT at login via a Supabase custom access token hook. Server actions call `getSession()` (local JWT decode, no network call) and read `session.user.app_metadata.venue_id` / `.role` — eliminating the per-request profile query entirely.

Register the hook in **Supabase Dashboard → Authentication → Hooks → Custom Access Token Hook**, pointing at `public.custom_access_token_hook`. See README for the full SQL.

---

## Domain Types (`src/lib/pool-types.ts`)

```ts
interface Rate {
  id: string
  name: string           // maps from DB field `label`
  pricePerHour: number
  isDefault: boolean
  isPeakRate: boolean    // true if label contains "peak" — set in actions.ts mapping
}

interface TableSession {
  id: string
  tableId: string
  playerName?: string
  rateId: string
  startTime: Date
  endTime?: Date
}

interface PoolTable {
  id: string
  name: string
  tableNumber: number    // maps from DB field `display_order`
  session?: TableSession // present = table is occupied
}

interface TodaySession {              // defined in actions.ts, not pool-types.ts
  id: string
  tableName: string
  playerName?: string
  rateLabel: string
  startedAt: string      // ISO
  endedAt: string        // ISO
  actualRateCharged: number
}
```

---

## Billing Logic (`src/lib/pool-types.ts`)

### `isPeakHour(date): boolean`
Peak window: **Friday 8:00 PM → Sunday 3:00 AM** (local time).

### `calculateAmountOwed(startTime, rate, peakRate, endTime?): number`
- `peakRate` is passed explicitly — callers compute it as `rates.reduce((max, r) => Math.max(max, r.pricePerHour), 0)`
- If `rate.pricePerHour >= peakRate` → continuous billing (hours × rate). Covers non-league ($25) and peak ($25).
- Otherwise (league, $15) → whole-hour boundary billing from session start, with peak-hour transitions at each hour mark

### `sessionAmount(s: TodaySession): number`
Hours × `actual_rate_charged` for a completed session. Used in both `actions.ts` and `summary-drawer.tsx`.

### `formatDuration(startTime, endTime?): string` → `"HH:MM:SS"`
### `formatTime(date): string` → 12-hour local time
### `formatCurrency(amount): number` → USD

**There is no global `RATES` singleton.** Rates are loaded in `page.tsx` via `loadDashboardData()`, stored in `useState`, and passed as a `rates: Rate[]` prop to every component that needs them (`TableCard`, `StartSessionModal`, `EndSessionModal`).

---

## Dashboard State (`src/app/dashboard/page.tsx`)

Client component. Key state:
- `tables: PoolTable[]` — rendered as TableCard grid (1/2/3 columns at sm/md/lg)
- `rates: Rate[]` — passed as prop to `TableCard`, `StartSessionModal`, `EndSessionModal`
- `isOwner: boolean` — controls summary button visibility
- `todayRevenue`, `todayCompletedSessionsCount` — header stat chips
- `startModalTable`, `endModalTable` — which table's modal is open (null = closed)
- `summaryOpen` — summary drawer visibility

`load()` is called once on mount via `useEffect`. Uses a generation counter (`loadGenRef`) to discard stale responses if called again before the previous request resolves.

`refresh()` re-calls `loadDashboardData()` and updates tables + revenue stats. Called after every start/end action. Does not update `rates` (they don't change during a session).

Data load has a 15-second timeout with an error state displayed on failure.

---

## UI Patterns

- **Class merging:** Always use `cn()` from `@/lib/utils` for conditional Tailwind classes
- **Server Actions in client components:** Import directly and call in event handlers or `useActionState`
- **Modals:** Plain conditional renders (not portals) using absolute/fixed positioning
- **Drawer:** `Sheet` component from `src/components/ui/sheet.tsx` (Radix Dialog, slides from right)
- **Fonts:** `--font-dm-sans` (body), `--font-exo-2` (headings) — set as CSS variables on `<html>`
- **Colors:** OKLCH in `globals.css`. Primary = cyan/teal. Success = green (revenue amounts). Background = deep navy

---

## Multi-Tenancy Rules

Every server action that touches data **must**:
1. Call `getProfileFromToken(supabase)` — reads `venue_id`, `role`, and `userId` from the local JWT (no network call; throws if unauthenticated or claims missing)
2. Filter every query with `.eq("venue_id", venueId)` or `.in("table_id", venueTableIds)` for sessions
3. Validate any client-supplied IDs (tableId, rateId) against the venue before using them

Violations allow cross-venue data access. RLS is off, so application-level scoping is the only guard.
