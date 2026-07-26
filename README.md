# Chalk

**Chalk** is a multi-tenant pool hall management SaaS for venues that need fast table tracking, staff workflows, menu ordering, checkout, receipts, and owner-facing revenue visibility.

The current app supports both the original Shy Lounge pilot path and self-serve onboarding for new venues.

---

## Product Capabilities

### SaaS platform capabilities

- **Self-serve signup and onboarding**: new owners create an account, set up a venue, subscribe via Stripe Checkout, optionally invite staff, and complete onboarding.
- **Stripe subscription billing**: each venue is mapped to a Stripe Customer and subscription. Owners can open the Stripe Billing Portal, and Stripe webhooks sync subscription state back into Supabase.
- **Subscription access control**: protected app routes require authentication, a venue membership, completed onboarding, and a non-blocked subscription. Mutating APIs return `402` when the subscription is inactive.
- **Multi-tenant venue isolation**: app data is scoped by the authenticated user's venue through JWT claims and membership fallbacks.
- **Team management**: owners can invite members, assign roles, change roles, and remove members. The app protects against removing or demoting the last owner.
- **Audit logging**: all user-facing mutations are recorded in an append-only `audit_log` table via database triggers, capturing before/after state, actor, and optional application context.
- **Password reset**: forgot-password and reset-password flows via Supabase Auth email link.
- **Pilot compatibility**: legacy `users` rows are still supported while new signups use `venue_members`.

### Venue customer capabilities

- **Live table dashboard**: staff see active tables as cards with free/occupied state, live timers, player names, rate labels, and running amount owed.
- **Session lifecycle**: staff can start sessions, snapshot the rate at start time, close sessions directly, or move into checkout.
- **Bar tabs**: food/drink-only sessions without a pool table — tracked alongside table sessions on the dashboard.
- **Rate tier management**: owners and managers can configure rate tiers, defaults, active/inactive state, and sort order.
- **Table management**: owners and managers can add/edit tables, set size, display order, default rate, and admin status (`active`, `maintenance`, `retired`).
- **Venue settings**: owners can configure tax rate, currency, peak-hour days/times, business-day cutoff hour, and receipt footer.
- **Menu management**: venues can maintain food/drink menu items with categories, prices, availability, and stock quantities.
- **Ordering during a session**: staff can add menu items to active sessions, update quantities, remove items, and keep item prices snapshotted at order time.
- **Stock-safe item updates**: order item mutations use database functions that lock rows and adjust stock atomically.
- **Automated stock shipments**: recurring restock schedules (weekly or interval-based) that automatically adjust menu item stock via a daily Vercel Cron job.
- **Checkout**: sessions can be checked out by cash or Stripe card payment. Successful checkout records payment, closes the session, and frees the table.
- **Receipts**: completed payments generate printable receipts with venue, session, order, total, and payment details.
- **Revenue reporting**: owners can view date-range revenue, session count, average session length, peak-hour counts, and rate-tier breakdown from the `payments` table.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Lucide icons |
| Database/Auth | Supabase Postgres + Supabase Auth + SSR cookies |
| Payments | Stripe subscriptions and Stripe PaymentIntents |
| Testing | Vitest + happy-dom |
| Deployment target | Vercel |

> This project uses Next.js 16. Before changing framework-specific code, read the relevant docs in `node_modules/next/dist/docs/`. In this version, `middleware.ts` is `proxy.ts`, and `export function middleware()` is `export function proxy()`.

---

## App Surfaces

### Public and auth

- `/` redirects to `/login`
- `/login` signs existing users in with Supabase email/password auth
- `/signup` creates new Supabase Auth users
- `/forgot-password` sends a password reset email
- `/reset-password` sets a new password from the reset link
- `/accept-invite` lets invited users accept venue membership
- `/onboarding` creates a venue, Stripe customer/subscription record, optional staff invite, and marks onboarding complete
- `/billing/blocked` explains inactive subscription state and gives owners a billing portal path

### Venue operations

- `/dashboard` is the main staff floor view (tables + tabs)
- `/tabs` shows open bar tabs with order totals
- `/session/[id]` is the active session order and running total view
- `/session/[id]/checkout` handles card or cash checkout
- `/session/[id]/receipt` shows a printable receipt

### Admin and reporting

- `/admin/tables` manages venue tables
- `/admin/rates` manages table-rate tiers
- `/admin/settings` configures venue-level settings (tax, peak hours, receipt footer)
- `/admin/team` manages venue members and invites
- `/admin/billing` shows subscription status and links owners to the Stripe Billing Portal
- `/menu` manages menu items and stock
- `/revenue` shows owner-only revenue analytics

### API and background jobs

- `/api/admin/{tables,rates,settings,shipments}` — CRUD for admin pages
- `/api/menu` — CRUD for menu items
- `/api/sessions/[id]/{items,totals,checkout/*,receipt,receipt-data}` — session ordering and checkout
- `/api/team`, `/api/auth/accept-invite` — team management and invite acceptance
- `/api/billing/{checkout,portal,subscription}` — Stripe Checkout/Portal/status
- `/api/onboarding/{venue,checkout,complete}` — onboarding wizard backend
- `/api/webhooks/stripe/billing` — Stripe subscription webhook (signature-verified)
- `/api/cron/stock-shipments` — daily Vercel Cron for automated stock restock

---

## Key Domain Rules

- A venue is the tenant boundary. Every data read/write must be scoped to `venue_id`.
- Active pool sessions are `sessions` rows where `ended_at is null`.
- A "tab" is a session with `table_id`/`rate_id` null — food/drink only, no pool table.
- `actual_rate_charged` is snapshotted on the session when it starts. Do not recalculate historical sessions from the current rate row.
- Table-session billing is live while a session is active (peak-hour boundary-based pricing).
- Menu item prices are snapshotted into `order_items.price_at_time_cents`.
- Payments are stored in `payments`; card checkout uses Stripe PaymentIntents, cash checkout records a succeeded cash payment.
- Checkout confirmation closes the session and frees the table.
- The current business-day dashboard summary uses a configurable cutoff hour (default **3:00 AM to 3:00 AM** local venue day).
- RLS is only partially enabled. Core app code still relies heavily on application-level `venue_id` filtering.

---

## Roles

| Role | Current capabilities |
|---|---|
| Owner | Dashboard, ordering, checkout, revenue, billing, team management, tables/rates/settings admin, menu management, stock shipments |
| Manager | Dashboard, ordering, checkout, tables/rates admin, menu management, team read access |
| Staff | Dashboard, ordering, checkout |

Menu management (create/update/delete on `/api/menu`) is gated to owner/manager; read access (`GET`) is open to all staff.

---

## Environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

NEXT_PUBLIC_APP_URL=http://localhost:3000

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID_CHALK_MONTHLY=price_...
STRIPE_BILLING_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

INVITE_EMAIL_PROVIDER=supabase
CRON_SECRET=your_cron_secret
```

`STRIPE_PRICE_ID_CHALK_MONTHLY` is required for onboarding — it powers the Stripe Checkout session that collects payment when a new venue subscribes.

`CRON_SECRET` authenticates the Vercel Cron stock-shipments endpoint.

---

## Local Development

Install dependencies:

```bash
npm install
```

Apply Supabase migrations:

```bash
supabase db push
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run tests:

```bash
npm test
```

---

## Testing

The project uses Vitest with `happy-dom` for unit and integration tests. Tests live in a top-level `tests/` folder mirroring `src/`. See [TESTING.md](TESTING.md) for the full test layout and commands.

Current coverage areas:
- Billing math (peak-hour windows, boundary-based pricing)
- Currency formatting, class merging, tax computation
- Auth/tenancy (`getProfile` JWT claims + DB fallbacks)
- API auth helpers (profile resolution, role gating)
- Dashboard server actions (venue scoping, rate snapshots)
- Session totals API (table-time + line-item math)
- Role gating across admin endpoints
- Stock shipment scheduling
- Component rendering (CartTotals, PoolBall)

---

## Supabase Setup

The app depends on the Supabase Custom Access Token Hook so server actions can read `venue_id` and `role` from JWT claims.

After applying migrations, register the hook in:

**Supabase Dashboard -> Authentication -> Hooks -> Custom Access Token Hook**

Point it at:

```text
public.custom_access_token_hook
```

Use [docs/JWT_HOOK_TEST.md](docs/JWT_HOOK_TEST.md) to verify both legacy and onboarding-created users receive valid claims.

For the existing Shy Lounge pilot billing mapping, use [docs/PILOT_SETUP.md](docs/PILOT_SETUP.md).

---

## Security Headers

Production responses include HSTS, X-Frame-Options (DENY), X-Content-Type-Options, Referrer-Policy, Content-Security-Policy, and Permissions-Policy via `vercel.json`.

---

## Current Gaps

- Terminal/Tap to Pay is visible as a disabled checkout option.
- Core app tables are not fully protected by final production RLS policy coverage.
- Revenue reporting does not yet break down by payment method.

---

## Project Structure

```text
src/
  proxy.ts                         Next.js 16 route-protection entry point
  app/
    login/                         Login UI and server actions
    signup/                        Account signup
    forgot-password/               Password reset request
    reset-password/                Password reset completion
    accept-invite/                 Invite acceptance UI
    onboarding/                    Venue onboarding flow
    billing/blocked/               Subscription dunning page
    dashboard/                     Main floor dashboard and session server actions
    tabs/                          Open bar tabs view
    session/[id]/                  Active session, checkout, receipt flows
    menu/                          Menu item admin UI
    revenue/                       Owner revenue analytics
    navigation/                    Sidebar context loader
    admin/
      billing/                     Subscription status and billing portal entry
      rates/                       Rate tier admin
      settings/                    Venue settings (tax, peak hours, receipt footer)
      tables/                      Table admin
      team/                        Team and invite management
    api/
      admin/{tables,rates,settings,shipments}/  CRUD for admin pages
      billing/                     Stripe Checkout/Portal/subscription
      cron/stock-shipments/        Daily automated stock restock
      menu/                        Menu item CRUD
      onboarding/                  Onboarding wizard backend
      sessions/                    Session ordering, totals, checkout, receipts
      team/                        Team management and invites
      auth/accept-invite/          Invite token acceptance
      webhooks/stripe/billing/     Stripe subscription webhook
  components/
    admin/                         Table/rate admin forms and tables
    billing/                       Billing, onboarding, team UI
    dashboard/                     Dashboard shell, cards, modals, sidebar
    ordering/                      Menu, order, checkout, receipt UI
    icons/                         Custom SVG icons
    login/                         Login page background animation
    ui/                            shadcn/ui primitives
  lib/
    auth.ts                        Current request profile helper
    audit.ts                       Audit context helper for DB triggers
    billing/                       Billing profile, role, and subscription helpers
    billing-table.ts               Server-side table-time billing (cents, timezone-aware)
    business-day.ts                Business day boundary math
    format.ts                      Currency formatting (formatCAD)
    pool-types.ts                  Pool session domain types and client-side billing
    shipment-schedule.ts           Stock shipment cadence math
    snapshot-time.ts               Checkout snapshot timestamp validation
    stripe.ts                      Stripe client
    tax.ts                         Venue tax rate and tax computation
    utils.ts                       cn() class merging
  utils/supabase/                  Browser, server, admin Supabase clients
tests/                             Vitest test suite (mirrors src/)
supabase/
  migrations/                      Database schema and function migrations
docs/
  JWT_HOOK_TEST.md                 JWT hook verification plan
  PILOT_SETUP.md                   One-time Shy Lounge pilot billing setup
```
