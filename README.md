# Chalk

**Chalk** is a multi-tenant pool hall management SaaS for venues that need fast table tracking, staff workflows, menu ordering, checkout, receipts, and owner-facing revenue visibility.

The current app supports both the original Shy Lounge pilot path and self-serve onboarding for new venues.

---

## Product Capabilities

### SaaS platform capabilities

- **Self-serve signup and onboarding**: new owners create an account, set up a venue, start a trial subscription, optionally invite staff, and complete onboarding.
- **Stripe subscription billing**: each venue is mapped to a Stripe Customer and subscription. Owners can open the Stripe Billing Portal, and Stripe webhooks sync subscription state back into Supabase.
- **Subscription access control**: protected app routes require authentication, a venue membership, completed onboarding, and a non-blocked subscription. Mutating APIs return `402` when the subscription is inactive.
- **Multi-tenant venue isolation**: app data is scoped by the authenticated user's venue through JWT claims and membership fallbacks.
- **Team management**: owners can invite members, assign roles, change roles, and remove members. The app protects against removing or demoting the last owner.
- **Pilot compatibility**: legacy `users` rows are still supported while new signups use `venue_members`.

### Venue customer capabilities

- **Live table dashboard**: staff see active tables as cards with free/occupied state, live timers, player names, rate labels, and running amount owed.
- **Session lifecycle**: staff can start sessions, snapshot the rate at start time, close sessions directly, or move into checkout.
- **Rate tier management**: owners and managers can configure rate tiers, defaults, active/inactive state, and sort order.
- **Table management**: owners and managers can add/edit tables, set size, display order, default rate, and admin status (`active`, `maintenance`, `retired`).
- **Menu management**: venues can maintain food/drink menu items with categories, prices, availability, and stock quantities.
- **Ordering during a session**: staff can add menu items to active sessions, update quantities, remove items, and keep item prices snapshotted at order time.
- **Stock-safe item updates**: order item mutations use database functions that lock rows and adjust stock atomically.
- **Checkout**: sessions can be checked out by cash or Stripe card payment. Successful checkout records payment, closes the session, and frees the table.
- **Receipts**: completed payments generate printable receipts with venue, session, order, total, and payment details.
- **Revenue reporting**: owners can view date-range table-session revenue, session count, average session length, peak-hour counts, and rate-tier breakdown.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Lucide icons |
| Database/Auth | Supabase Postgres + Supabase Auth + SSR cookies |
| Payments | Stripe subscriptions and Stripe PaymentIntents |
| Deployment target | Vercel |

> This project uses Next.js 16. Before changing framework-specific code, read the relevant docs in `node_modules/next/dist/docs/`. In this version, `middleware.ts` is `proxy.ts`, and `export function middleware()` is `export function proxy()`.

---

## App Surfaces

### Public and auth

- `/` redirects to `/login`
- `/login` signs existing users in with Supabase email/password auth
- `/signup` creates new Supabase Auth users
- `/accept-invite` lets invited users accept venue membership
- `/onboarding` creates a venue, Stripe customer/subscription record, optional staff invite, and marks onboarding complete
- `/billing/blocked` explains inactive subscription state and gives owners a billing portal path

### Venue operations

- `/dashboard` is the main staff floor view
- `/session/[id]` is the active session order and running total view
- `/session/[id]/checkout` handles card or cash checkout
- `/session/[id]/receipt` shows a printable receipt

### Admin and reporting

- `/admin/tables` manages venue tables
- `/admin/rates` manages table-rate tiers
- `/admin/team` manages venue members and invites
- `/admin/billing` shows subscription status and links owners to the Stripe Billing Portal
- `/menu` manages menu items and stock
- `/revenue` shows owner-only table-session revenue analytics

---

## Key Domain Rules

- A venue is the tenant boundary. Every data read/write must be scoped to `venue_id`.
- Active pool sessions are `sessions` rows where `ended_at is null`.
- `actual_rate_charged` is snapshotted on the session when it starts. Do not recalculate historical sessions from the current rate row.
- Table-session billing is live while a session is active.
- Menu item prices are snapshotted into `order_items.price_at_time_cents`.
- Payments are stored in `payments`; card checkout uses Stripe PaymentIntents, cash checkout records a succeeded cash payment.
- Checkout confirmation closes the session and frees the table.
- The current business-day dashboard summary uses a **3:00 AM to 3:00 AM** local venue day.
- RLS is only partially enabled. Core app code still relies heavily on application-level `venue_id` filtering.

---

## Roles

| Role | Current capabilities |
|---|---|
| Owner | Dashboard, ordering, checkout, revenue, billing, team management, tables/rates admin, menu management |
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
```

`STRIPE_PRICE_ID_CHALK_MONTHLY` is optional for local onboarding experiments, but without it onboarding creates only the local subscription row/trial metadata and no Stripe subscription object.

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

## Current Gaps

- No automated test suite yet.
- Revenue reporting is based on completed table sessions and does not yet fully report menu item/payment revenue.
- Tax and tip are modeled but currently recorded as `0`.
- Terminal/Tap to Pay is visible as a disabled checkout option.
- Menu management APIs need role enforcement beyond venue scoping.
- Core app tables are not fully protected by final production RLS policy coverage.
- Some subscription period fields depend on Stripe API behavior and should be rechecked before production billing launch.

---

## Project Structure

```text
src/
  proxy.ts                         Next.js 16 route-protection entry point
  app/
    login/                         Login UI and server actions
    signup/                        Account signup
    accept-invite/                 Invite acceptance UI
    onboarding/                    Venue onboarding flow
    dashboard/                     Main floor dashboard and session server actions
    session/[id]/                  Active session, checkout, receipt flows
    menu/                          Menu item admin UI
    revenue/                       Owner revenue analytics
    admin/
      billing/                     Subscription status and billing portal entry
      rates/                       Rate tier admin
      tables/                      Table admin
      team/                        Team and invite management
    api/                           Route handlers for admin, billing, team, menu, sessions
  components/
    admin/                         Table/rate admin forms and tables
    billing/                       Billing, onboarding, team UI
    dashboard/                     Dashboard shell, cards, modals, sidebar
    ordering/                      Menu, order, checkout, receipt UI
    ui/                            shadcn/ui primitives
  lib/
    auth.ts                        Current request profile helper
    billing/                       Billing profile, role, and subscription helpers
    pool-types.ts                  Pool session domain types and billing helpers
    stripe.ts                      Stripe client
  utils/supabase/                  Browser, server, admin Supabase clients
supabase/
  migrations/                      Database schema and function migrations
  seed.sql                         Pilot-only billing setup template
docs/
  JWT_HOOK_TEST.md                 JWT hook verification plan
  PILOT_SETUP.md                   One-time Shy Lounge pilot billing setup
```
