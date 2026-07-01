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
- Stripe (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`) — subscription billing (venue signup) and in-app card payments (session checkout)
- Zod — request body validation in API routes
- Sonner — toast notifications
- Vercel

---

## Database Schema

Migrations live in `supabase/migrations/`. Core tables (`venues`, `users`, `tables`, `rates`, `sessions`) predate the billing/ordering work and still have RLS **off**; every newer table has RLS **on** (see Key Conventions below).

```sql
venues (
  id uuid primary key,
  name text,
  timezone text,
  tax_rate numeric(5,3) default 0,        -- percentage, e.g. 13.000 = 13%; see lib/tax.ts
  stripe_customer_id text unique,
  onboarding_completed_at timestamptz,    -- null = venue hasn't finished onboarding
  created_at timestamptz
)

users (
  id uuid primary key references auth.users(id),
  venue_id uuid references venues(id),
  name text,
  role text, -- 'owner', 'manager', or 'staff' — LEGACY. Pre-onboarding accounts (Shy Lounge) only.
  created_at timestamptz
)

-- Multi-venue membership + role source of truth for anyone who signed up via /signup + /onboarding.
venue_members (
  id uuid primary key,
  venue_id uuid references venues(id),
  user_id uuid references auth.users(id),
  role text check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz,
  unique (venue_id, user_id)
)

venue_invites (
  id uuid primary key,
  venue_id uuid references venues(id),
  email text,
  role text check (role in ('owner', 'manager', 'staff')),
  token text unique,
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz
)

tables (
  id uuid primary key,
  venue_id uuid references venues(id),
  name text,
  size text,             -- '9ft' or 'bar_box'
  status text,           -- 'free', 'occupied', 'inactive', or 'maintenance'
  display_order integer,
  default_rate_id uuid references rates(id)  -- on delete set null
)

rates (
  id uuid primary key,
  venue_id uuid references venues(id),
  label text,
  hourly_rate numeric(10,2),
  is_default boolean,
  active boolean default true,     -- soft-delete; inactive rates stay visible only on sessions still referencing them
  sort_order integer default 0
)

sessions (
  id uuid primary key,
  venue_id uuid references venues(id),
  table_id uuid references tables(id),        -- nullable: null = a "tab" (food/drink only, no pool table)
  rate_id uuid references rates(id),           -- nullable for tabs
  staff_id uuid references users(id),
  started_at timestamptz,
  ended_at timestamptz,         -- null means session is active
  actual_rate_charged numeric(10,2),  -- nullable for tabs
  notes text,
  player_name text
)

menu_items (
  id uuid primary key,
  venue_id uuid references venues(id),
  name text,
  category text,
  price_cents integer,            -- money is stored in cents from here on
  available boolean default true,
  stock_quantity integer,         -- null = unlimited, 0 = sold out
  sort_order integer default 0,
  created_at timestamptz
)

order_items (
  id uuid primary key,
  venue_id uuid references venues(id),
  session_id uuid references sessions(id),
  menu_item_id uuid references menu_items(id),
  quantity integer,
  price_at_time_cents integer,    -- snapshotted at order time, same pattern as actual_rate_charged
  created_at timestamptz
)

payments (
  id uuid primary key,
  venue_id uuid references venues(id),
  session_id uuid unique references sessions(id),  -- one payment per session (checkout)
  method text,                    -- 'card' | 'cash' | 'terminal'
  table_total_cents integer,
  items_total_cents integer default 0,
  tax_cents integer default 0,
  tip_cents integer default 0,
  grand_total_cents integer,
  stripe_payment_intent_id text,
  status text,                    -- 'pending' | 'succeeded' | 'failed' | 'refunded'
  created_at timestamptz
)

subscriptions (
  id uuid primary key,
  venue_id uuid unique references venues(id),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text,                    -- 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused'
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz,
  updated_at timestamptz
)

processed_stripe_billing_events (
  stripe_event_id text primary key,   -- idempotency guard for the Stripe webhook handler
  created_at timestamptz
)
```

---

## Seeded Data (Shy Lounge)
- 1 venue: Shy Lounge, owner Vish — the original pilot venue, created before onboarding/billing existed
- 2 tables: Table 1, Table 2 (both 9ft)
- 3 rates: League ($15/hr), Non-League ($25/hr), Peak ($25/hr)
- Because this venue predates `onboarding_completed_at`/`subscriptions`, migration `20260628000000_backfill_pilot_billing.sql` auto-backfills a placeholder `active` subscription for any venue missing one, so the paywall middleware doesn't lock it out. See `docs/PILOT_SETUP.md` before moving it onto a real Stripe customer.
- All venues created via `/signup` → `/onboarding` go through real Stripe checkout instead (see Auth & Routing)

---

## Key Conventions

- **Active session** = `sessions` row where `ended_at` is null
- **A "tab"** = a `sessions` row with `table_id`/`rate_id`/`actual_rate_charged` all null — food/drink ordering without a pool table
- **Always snapshot pricing at the time of the action** — `actual_rate_charged` on session start, `price_at_time_cents` on order-item insert — never recalculate historical charges from the current `rates`/`menu_items` row
- **RLS is mixed, not uniformly off.** Core tables (`venues`, `users`, `tables`, `rates`, `sessions`) still have RLS disabled for development — do not enable without explicit instruction. Everything added since (`venue_members`, `venue_invites`, `subscriptions`, `processed_stripe_billing_events`, `menu_items`, `order_items`, `payments`) has RLS **on**, scoped via `current_user_venue_id()`/`current_venue_id()` JWT helpers. Don't assume either posture — check the relevant migration.
- **All queries must be scoped to `venue_id`** — a logged-in user belongs to exactly one venue (via `venue_members`, or `users.role` for legacy accounts); every table/session/rate/revenue query must be filtered by that venue. Obtain the profile via `getProfile()` (`src/lib/auth.ts`) in most server actions, or `requireProfile()`/`requireRole()` (`src/lib/billing/server.ts`) in API routes — see Multi-Tenancy Rules
- **Money is cents in every table added after the original schema** (`menu_items`, `order_items`, `payments` — all `*_cents` integer columns). The original `sessions.actual_rate_charged`/`rates.hourly_rate` stay `numeric` dollars. Don't mix units without converting.
---

## File & Route Structure

```
src/
  proxy.ts                        — Middleware entry point (renamed from middleware.ts)
  app/
    page.tsx                      — Redirects / → /login
    layout.tsx                    — Root layout: DM Sans + Exo 2 fonts, dark theme
    globals.css                   — OKLCH color system, dark theme, success utilities
    login/                        — page.tsx, functions.tsx (client form), actions.ts (loginAction, logoutAction)
    signup/page.tsx                — Signup form → email confirmation → /onboarding
    accept-invite/page.tsx         — Invite-token acceptance flow (joins an existing venue)
    onboarding/page.tsx             — Post-signup wizard: venue details → Stripe checkout → optional team invite → complete
    billing/blocked/page.tsx        — Shown when the venue's subscription is past_due/canceled/etc (dunning)
    dashboard/
      page.tsx                    — Pool table dashboard (client component)
      actions.ts                  — loadDashboardData, startSessionAction, endSessionAction, startTabAction (own local getProfileFromToken — see Multi-Tenancy Rules)
    tabs/                          — page.tsx + actions.ts (loadOpenTabs) — bar tabs without a pool table
    menu/page.tsx                   — Admin food & drink menu manager
    session/[id]/
      page.tsx                    — Session detail: menu browser, order list, cart totals
      checkout/page.tsx           — Card/cash checkout for a session
      receipt/page.tsx            — Printable receipt
      actions.ts                  — getSessionDetail, getMenuItems
    revenue/                       — page.tsx (owner/manager-only), _client.tsx, actions.ts (loadRevenueData)
    navigation/actions.ts           — loadNavigationContext() — venueName/isAdmin/isOwner for the sidebar
    admin/
      tables/, rates/, settings/   — page.tsx + _client.tsx per section (owner/manager)
      billing/page.tsx             — Subscription status + Stripe portal link (owner-gated in-page)
      team/page.tsx                — Member list, role changes, invites (owner/manager; invites are owner-only)
    api/
      admin/{tables,rates,settings}/**  — CRUD for the admin pages above
      menu/**                            — CRUD for menu_items
      sessions/[id]/{items,totals,checkout/intent,checkout/confirm,receipt,receipt-data}/**
      team/**, auth/accept-invite/       — team management + invite acceptance
      billing/{checkout,portal,subscription}/**  — Stripe Checkout/Portal/status
      onboarding/{venue,checkout,complete}/**    — onboarding wizard backend
      webhooks/stripe/billing/route.ts           — Stripe subscription webhook (signature-verified)
      See "API Routes" below for the security/error pattern shared by all of these.
  components/
    dashboard/
      sidebar.tsx                 — Nav with role-gated sections (main / Admin / Owner), used instead of a header-only layout
      sidebar-layout.tsx          — Fixed desktop sidebar (collapsible) + mobile slide-over
      sidebar-page-layout.tsx     — Async wrapper: calls loadNavigationContext() then renders SidebarLayout
      header.tsx, table-card.tsx, start-session-modal.tsx, end-session-modal.tsx, pool-ball.tsx (summary-drawer.tsx was removed — superseded by the standalone Revenue page)
      start-tab-modal.tsx, tab-card.tsx — tab creation + display
    admin/                        — rate-form-sheet, rates-admin, table-form-sheet, tables-admin, venue-settings (tax rate)
    billing/                      — onboarding-shell, plan-card, subscription-status, dunning-banner, billing-portal-button, invite-member-dialog, team-member-row, role-select
    ordering/                     — menu-browser, menu-item-card, menu-item-form-sheet, order-list, cart-totals, cash-confirm-dialog, stripe-payment-form, receipt
    login/
      light-waves.tsx             — Animated SVG wave background (login page)
    ui/                           — shadcn primitives: button, input, label, sheet, card, badge, calendar, dialog, popover, select, separator, skeleton, sonner, switch, table, tabs
    icons/                        — Custom SVG icons: avatar, lock, envelope
  hooks/
    use-device-type.ts
  lib/
    pool-types.ts                — Domain interfaces + client-side/display billing math (calculateAmountOwed, isPeakHour) — see Billing Logic for how this relates to billing-table.ts
    billing-table.ts             — Canonical server-side table-time billing in cents, timezone-aware (tableTotalCents, sessionTableTotalCents) — the actual charge applied at checkout
    billing/server.ts            — API-route auth helpers: requireProfile, requireRole, apiError, HttpError, loadSubscriptionSummary
    billing/types.ts             — VenueRole, SubscriptionStatus, RequestProfile, SubscriptionSummary types
    auth.ts                      — getProfile() — shared profile/role lookup used by most server actions and API routes (JWT claims → venue_members → legacy users fallback)
    business-day.ts              — todayBoundsUTC, businessDayRangeUTC — 3am–3am business day math in a venue's timezone
    tax.ts                       — getVenueTaxRate, computeTaxCents
    format.ts                    — formatCAD(cents) — used everywhere money is stored in cents (menu, orders, payments, revenue)
    stripe.ts                    — Stripe server client
    utils.ts                     — cn() = clsx + tailwind-merge
  utils/supabase/
    server.ts                    — createClient() for Server Actions (cookie-based SSR)
    client.ts                    — createClient() for browser components
    admin.ts                     — createAdminClient() — service-role client, used server-side only (billing/webhooks)
    middleware.ts                — updateSession() — validates auth, syncs cookies, redirects, enforces onboarding + subscription paywall
```

---

## Server Actions (`src/app/dashboard/actions.ts`)

All actions authenticate the user and retrieve their `venue_id` before any query. Never skip this.

### `loadDashboardData()`
Returns `{ tables, rates, tabs, userRole, venueName, todayRevenue, todayCompletedSessionsCount }`.
- Fetches tables (status in `'free'`/`'occupied'`, ordered by display_order)
- Fetches all open sessions (active table sessions AND tabs) for the venue in one query, then splits by `table_id === null`
- Fetches rates for venue — filters to `active` rates, but keeps an inactive rate visible if a currently-open session still references it
- Calls `loadTodaySummaryForVenue()` for revenue stats (now includes `order_items` alongside table time)

### `startTabAction(playerName?)`
Inserts a session with `table_id`/`rate_id` null and `actual_rate_charged: 0` — a bar tab with no pool table.

### `startSessionAction(tableId, rateId, playerName?)`
- Validates `tableId` belongs to user's venue
- Validates `rateId` belongs to user's venue
- Snapshots `hourly_rate` → `actual_rate_charged` at insert time
- Inserts session row; updates table status to `'occupied'`

### `endSessionAction(tableId)`
- Validates `tableId` belongs to user's venue
- Sets `ended_at = now()` on the active session
- Updates table status to `'free'`
- Note: this is the direct "end without billing" path. Charging a session (table time + order items + tax/tip) goes through `/session/[id]/checkout` and the `/api/sessions/[id]/checkout/*` routes instead, which write a `payments` row.

### `getProfileFromToken(supabase)` (internal, local to this file)
Returns `{ venueId, role, userId }` — tries JWT `app_metadata` claims first, then falls back to `venue_members`, then legacy `users`. This predates and duplicates `getProfile()` in `src/lib/auth.ts` (see Multi-Tenancy Rules) — the two aren't unified yet, so don't assume changing one updates the other.

### `loadTodaySummaryForVenue(supabase, profile)` (internal)
Calculates revenue for the current business day (3am–3am local time) from *completed* sessions' `actual_rate_charged` × duration, plus their `order_items`. Uses `todayBoundsUTC()` (`src/lib/business-day.ts`) to convert the venue's timezone to UTC bounds. This is a quick estimate for the dashboard header chip — the Revenue page (`loadRevenueData`, below) is the authoritative source since it reads from `payments`.

### Other server actions
- `src/app/tabs/actions.ts` — `loadOpenTabs()`: open tabs with their order items and running total
- `src/app/session/[id]/actions.ts` — `getSessionDetail(sessionId)`, `getMenuItems()`
- `src/app/revenue/actions.ts` — `loadRevenueData(from, to)`: owner/manager-only; sums the `payments` table for a date range — see Revenue Page below
- `src/app/navigation/actions.ts` — `loadNavigationContext()`: `{ venueName, isAdmin, isOwner }` for the sidebar, via `getProfile()`
- `src/app/login/actions.ts` — `loginAction`, `logoutAction`

---

## API Routes (`src/app/api/**/route.ts`)

Used for anything the admin/billing/ordering/onboarding UIs call from client components (server actions can't be called with dynamic per-item URLs the same way, and Stripe/webhook work needs real HTTP endpoints). Two auth patterns coexist:

- **Newer/preferred:** `requireProfile()` / `requireRole([...])` from `src/lib/billing/server.ts`, which throw `HttpError` on failure; wrap the handler body in `try { ... } catch (e) { return apiError(e) }`. Used by team, billing, onboarding, and session-checkout routes.
- **Older:** manual `getProfile()` call (`src/lib/auth.ts`) plus an explicit `ADMIN_ROLES = ["owner", "manager"]` check and a bare `try/catch` returning `{ error: "Unauthorized" }` (401). Used by `/api/menu`, `/api/admin/*`.

Both patterns follow the same security rules (added in the `c18db5a`/`79106bc` hardening pass — keep following them in new routes):
- Never return a raw Postgres/Supabase error message to the client — map DB errors to a generic `"Internal server error"` (500) and log server-side instead
- Validate request bodies with `zod` (`z.object({...}).safeParse(body)`); on failure return `{ error: parsed.error.flatten() }` (400)
- Every handler re-derives `venueId` from the profile and filters/inserts with it — never trust a venue id from the request body

`src/utils/supabase/middleware.ts` additionally paywalls a subset of API prefixes (`isPaywalledApiPath`) — see Auth & Routing.

---

## Auth & Routing

- `src/proxy.ts` runs on every request (except static assets)
- `updateSession()` in `src/utils/supabase/middleware.ts` does considerably more than auth redirects now:
  - Uses `getUser()` (validates with Supabase auth server) for redirect decisions — intentional, keeps route protection secure
  - Redirects any protected route (`/dashboard`, `/revenue`, `/menu`, `/session`, `/admin`) → `/login` if unauthenticated; redirects `/login` → `/dashboard` if already authenticated
  - Exempts `/login`, `/signup`, `/auth/callback`, `/billing/blocked`, `/accept-invite`, `/api/webhooks`, `/api/auth/accept-invite`, `/api/billing/portal` from the rest of the checks below
  - **Onboarding gate:** resolves `venueId` from the JWT (falling back to a `venue_members` lookup if the token predates the venue, e.g. immediately after signup), then checks `venues.onboarding_completed_at` and whether a `subscriptions` row exists. If either is missing, protected routes redirect to `/onboarding`; `/onboarding` itself redirects to `/dashboard` once both exist.
  - **Subscription paywall:** if the venue's `subscriptions.status` is one of `unpaid`/`canceled`/`incomplete`/`incomplete_expired`/`paused`, protected page routes redirect to `/billing/blocked`, and "paywalled" API prefixes (`/api/admin`, `/api/menu`, `/api/sessions`, `/api/team`, `/api/billing/checkout`) return `402` instead of running.
- Server-side Supabase client (`server.ts`) reads/writes auth cookies via Next.js `cookies()` API
- Browser client (`client.ts`) is for client components that need Supabase (auth actions, session refresh after onboarding steps — most data queries still go through Server Actions/API routes)
- `src/utils/supabase/admin.ts` — service-role client for server-only code that must bypass RLS (Stripe webhook handler, subscription lookups). Never import this into client-reachable code.

## JWT Claims Hook

`venue_id` and `role` are baked into the JWT at login via a Supabase custom access token hook (`public.custom_access_token_hook`, in `supabase/migrations/20260627160000_add_venue_members_and_jwt_hook.sql`). It checks `venue_members` first (multi-venue signups), falling back to the legacy `users` table (Shy Lounge and other pre-onboarding accounts). Server code reads `session.user.app_metadata.venue_id` / `.role` from the local JWT — no network call — via `getProfile()` (`src/lib/auth.ts`) or `getRequestProfile()`/`requireProfile()` (`src/lib/billing/server.ts`). Both of those also fall back to a live `venue_members`/`users` query if the claims are stale (e.g. right after onboarding creates a venue, before the token refreshes) — see the comment in `src/app/onboarding/page.tsx::createVenue()` for why that race exists.

Register the hook in **Supabase Dashboard → Authentication → Hooks → Custom Access Token Hook**, pointing at `public.custom_access_token_hook`. See README for the full SQL, and `docs/JWT_HOOK_TEST.md` for verifying it.

---

## Roles & Permissions

Three roles, unchanged in name from the original schema: `owner`, `manager`, `staff`. What's new is that access is now gated in several places, not just a single `userRole` check:

- `isAdmin = role === "owner" || role === "manager"`, `isOwner = role === "owner"` — computed in `src/app/navigation/actions.ts::loadNavigationContext()` and passed down to `SidebarLayout`/`SidebarContent` to filter nav items
- **Dashboard / tabs / menu ordering** — any authenticated venue member (all three roles)
- **`/admin/tables`, `/admin/rates`, `/admin/settings`, `/menu` (admin CRUD), `/api/admin/*`, `/api/menu`** — `owner` or `manager` (`ADMIN_ROLES` in the relevant API routes)
- **`/revenue`** — gated inconsistently: the page itself (`revenue/page.tsx`) redirects anyone who isn't `owner` to `/dashboard`, but the data-loading action (`revenue/actions.ts::loadRevenueData`) separately allows `owner` *or* `manager`. In practice this makes revenue owner-only (the page's check runs first), but don't take the action's role check at face value — if you loosen the page gate, check the action's gate too and vice versa.
- **`/admin/team` (view), `GET /api/team`** — `owner` or `manager`
- **`POST /api/team/invite`, role changes, member removal, `/admin/billing` actions, `POST /api/billing/portal`** — `owner` only. The billing *page* itself is reachable by non-owners (nav-gated as owner-only, but not page-gated) and shows "Ask an owner to update billing for this venue" instead of controls — don't rely on the sidebar hiding a link as the only access control; check role again in the page/route.

When adding a new admin surface, decide explicitly whether it's owner+manager or owner-only and check the corresponding `requireRole([...])` / `ADMIN_ROLES` / inline `role === "owner"` pattern used by similar existing routes — there's no single shared "is this route admin-only" helper.

---

## Domain Types (`src/lib/pool-types.ts`)

```ts
interface Rate {
  id: string
  name: string           // maps from DB field `label`
  pricePerHour: number
  isDefault: boolean
  isPeakRate: boolean    // true if label contains "peak" — set in actions.ts mapping
  isActive: boolean       // maps from DB field `active`
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
  defaultRateId?: string
  session?: TableSession // present = table is occupied
}
```

`OpenTab`/`OpenTabItem` (bar tabs) and `TodaySession` are defined locally in `dashboard/actions.ts`, not in `pool-types.ts`.

---

## Billing Logic

There are now **two** table-time billing implementations that must be kept in sync — `pool-types.ts` is for live client-side display, `billing-table.ts` is the canonical server-side charge:

### `src/lib/pool-types.ts` — client-side / display
- `isPeakHour(date): boolean` — peak window **Friday 8:00 PM → Sunday 3:00 AM**, evaluated against the *browser's* local time (`Date.getDay()`/`getHours()`)
- `calculateAmountOwed(startTime, rate, peakRate, endTime?): number` — dollars. `peakRate` is passed explicitly, computed by callers as `rates.reduce((max, r) => Math.max(max, r.pricePerHour), 0)`. If `rate.pricePerHour >= peakRate` → continuous billing (hours × rate). Otherwise → whole-hour boundary billing from session start, re-pricing each hour that *begins* in the peak window. Used to show a live running total on an open table card, before checkout.
- `formatDuration(startTime, endTime?): string` → `"HH:MM:SS"`, `formatTime(date)` → 12-hour local time, `formatCurrency(amount)` → **USD** dollars — still used by the original dashboard components (table cards, header chips, summary drawer, rates admin)

### `src/lib/billing-table.ts` — server-side / canonical
- `isPeakHourInTz(ms, timezone)` — same Fri 8pm→Sun 3am rule, but resolved in the *venue's* timezone (the server runs in UTC, so `Date.getHours()` can't be used here)
- `tableTotalCents(startMs, endMs, ratePerHour, peakRate, timezone)` — cents, same billing rule as `calculateAmountOwed` but timezone-correct
- `sessionTableTotalCents(supabase, venueId, startedAt, actualRateCharged, endMs)` — fetches the venue's timezone + rates, then calls `tableTotalCents`. This is what `/api/sessions/[id]/checkout/*` actually charges.

**If you change the peak-hour or billing-boundary rule, change both files** — they're intentionally parallel implementations, not a shared module, because one runs in the browser's local time and the other must run in the venue's timezone on the server.

### Revenue (`src/app/revenue/actions.ts`)
`loadRevenueData(from, to)` does **not** use either billing function above — it sums the `payments` table (`grand_total_cents`, `table_total_cents`, `items_total_cents`, `tax_cents`, `tip_cents`) for `status = 'succeeded'` rows in the date range, since that's the actual money collected (including tax/tips/food, which the billing functions don't know about). Treat `payments` as the source of truth for historical revenue; treat `pool-types.ts`/`billing-table.ts` as prospective/in-progress charge calculators.

### Tax (`src/lib/tax.ts`)
`getVenueTaxRate(supabase, venueId)` reads `venues.tax_rate` (a percentage, e.g. `13.000`) and returns it as a fraction (`0.13`). `computeTaxCents(subtotalCents, taxRate)` rounds `subtotal × rate`. Applied at checkout (`/api/sessions/[id]/checkout/*`, `/totals`) — never precomputed and stored anywhere except on the resulting `payments.tax_cents` row.

### Currency formatting — two formatters coexist, know which to use
- `formatCurrency` (`pool-types.ts`) — takes **dollars**, formats as **USD** — legacy dashboard components only (table cards, header, summary drawer, rates admin)
- `formatCAD` (`src/lib/format.ts`) — takes **cents**, formats as **CAD** — everything added since (menu, ordering, checkout, receipts, tabs, revenue page). This USD/CAD mismatch is a known inconsistency, not an intentional multi-currency feature — don't propagate it into new code; prefer `formatCAD` with a cents value for anything new.

**There is no global `RATES` singleton.** Rates are loaded in `page.tsx` via `loadDashboardData()`, stored in `useState`, and passed as a `rates: Rate[]` prop to every component that needs them (`TableCard`, `StartSessionModal`, `EndSessionModal`).

---

## Dashboard State (`src/app/dashboard/page.tsx`)

Client component. Key state:
- `tables: PoolTable[]` — rendered as TableCard grid (1/2/3 columns at sm/md/lg)
- `rates: Rate[]` — passed as prop to `TableCard`, `StartSessionModal`, `EndSessionModal`
- `isAdmin`, `isOwner: boolean` — passed to `SidebarLayout` to gate nav sections (see UI Patterns)
- `venueName` — passed to `SidebarLayout` and shown in the header
- `todayRevenue`, `todayCompletedSessionsCount` — header stat chips
- `startModalTable`, `endModalTable` — which table's modal is open (null = closed)

There is no `summaryOpen`/summary-drawer state anymore — that owner-only drawer was removed in favor of the standalone `/revenue` page.

`load()` is called once on mount via `useEffect`. Uses a generation counter (`loadGenRef`) to discard stale responses if called again before the previous request resolves.

`refresh()` re-calls `loadDashboardData()` and updates tables + revenue stats. Called after every start/end action. Does not update `rates` (they don't change during a session).

Data load has a 15-second timeout with an error state displayed on failure.

Other top-level pages (`/menu`, `/revenue`, `/admin/*`) follow the same shape but wrap their content in `SidebarPageLayout`, which internally calls `loadNavigationContext()` and renders `SidebarLayout` — they don't each reimplement `isAdmin`/`isOwner`/`venueName` loading the way `dashboard/page.tsx` still does.

---

## UI Patterns

- **Class merging:** Always use `cn()` from `@/lib/utils` for conditional Tailwind classes
- **Server Actions in client components:** Import directly and call in event handlers or `useActionState`
- **Modals:** Plain conditional renders (not portals) using absolute/fixed positioning
- **Sheets (side panels):** `Sheet` component from `src/components/ui/sheet.tsx` (Radix Dialog, slides from right) — used for admin create/edit forms (`rate-form-sheet.tsx`, `table-form-sheet.tsx`, `menu-item-form-sheet.tsx`)
- **Navigation:** `SidebarLayout`/`SidebarContent` (`src/components/dashboard/sidebar*.tsx`) replaced the old header-only layout — fixed collapsible sidebar on desktop (`lg:`), slide-over overlay on mobile. Nav items are grouped into main / "Admin" / "Owner" sections and filtered by `isAdmin`/`isOwner` booleans (`sidebar.tsx`'s `canSee()`) — see Multi-Tenancy Rules for how those booleans are derived
- **Toasts:** `sonner` (`src/components/ui/sonner.tsx`) for success/error notifications — prefer this over ad hoc alert banners for new features
- **Dialogs:** `src/components/ui/dialog.tsx` (Radix Dialog) for confirmation dialogs (e.g. `cash-confirm-dialog.tsx`), distinct from the plain-conditional-render "Modals" pattern above — new confirmation UI should use this rather than another bespoke modal
- **Fonts:** `--font-dm-sans` (body), `--font-exo-2` (headings) — set as CSS variables on `<html>`
- **Colors:** OKLCH in `globals.css`. Primary = cyan/teal. Success = green (revenue amounts). Background = deep navy. Sidebar has its own `bg-sidebar` token.
- **Currency:** see Billing Logic — `formatCAD` (cents) for anything new, not `formatCurrency` (dollars/USD)

---

## Multi-Tenancy Rules

Every server action or API route that touches data **must**:
1. Resolve the caller's profile before any query — `getProfile()` (`src/lib/auth.ts`) in most server actions, `requireProfile()`/`requireRole([...])` (`src/lib/billing/server.ts`) in most API routes, or the file-local `getProfileFromToken()` in `dashboard/actions.ts`. All three ultimately do JWT claims → `venue_members` → legacy `users` fallback, but they are three separate implementations — don't assume fixing a bug in one fixes the others.
2. Filter every query with `.eq("venue_id", venueId)` (or `.in("table_id"/"session_id", venueScopedIds)` for child tables like `order_items`)
3. Validate any client-supplied IDs (tableId, rateId, sessionId, menuItemId) against the venue before using them
4. In API routes, never leak raw DB error text to the response — see API Routes above

Violations allow cross-venue data access. RLS is off for the original core tables (`venues`/`users`/`tables`/`rates`/`sessions`), so application-level scoping is the only guard there — see the RLS note under Key Conventions for which newer tables DO have RLS as a second layer.
