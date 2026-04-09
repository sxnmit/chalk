# Chalk

**Chalk** is a pool hall management app built for venues that need a fast, no-friction way to track table sessions and daily revenue. Staff open and close sessions on individual tables; owners get a live view of what's happening on the floor and a running tally of the day's earnings.

---

## What it does

### Live table dashboard
Every active table is shown as a card on the dashboard. Free tables show a prompt to start a session. Occupied tables show a live timer, the amount currently owed, the player's name (if recorded), and the rate being charged — all updating in real time.

### Session management
Starting a session takes three taps: pick a table, enter a player name (optional), choose a rate. Ending one shows a summary — duration, rate, final amount — before confirming. The time of close and the amount charged are recorded to the session permanently.

### Rate types
Venues configure their own billing rates. The default seed includes:
- **League** — $15/hr, transitions to $25/hr automatically during peak hours (Friday 8pm through Sunday 3am)
- **Non-League** — $25/hr at all times, continuous billing
- **Peak** — $25/hr, for explicit peak-rate sessions

During peak hours, the rate selector is hidden and the peak rate is applied automatically.

### Today's summary (owners only)
Owners see a summary button in the header that opens a drawer listing every completed session for the current business day — player, table, rate, time range, and amount. A running total sits at the bottom.

### Business day logic
The "day" runs from **3:00 AM to 3:00 AM** local venue time, not midnight to midnight. This matches how a bar or lounge actually closes and handles late-night sessions correctly.

### Role-based access
- **Owner** — full dashboard + today's summary drawer
- **Staff** — full dashboard, no summary access

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database & Auth | Supabase (Postgres + SSR Auth) |
| Deployment | Vercel |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set up the database

Run the schema in your Supabase SQL editor:

```sql
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text,
  timezone text,
  created_at timestamptz default now()
);

create table users (
  id uuid primary key references auth.users(id),
  venue_id uuid references venues(id),
  name text,
  role text, -- 'owner' or 'staff'
  created_at timestamptz default now()
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  name text,
  size text, -- '9ft' or 'bar_box'
  status text default 'free', -- 'free', 'occupied', 'inactive'
  display_order integer
);

create table rates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  label text,
  hourly_rate numeric(10,2),
  is_default boolean default false
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  table_id uuid references tables(id),
  rate_id uuid references rates(id),
  staff_id uuid references users(id),
  started_at timestamptz,
  ended_at timestamptz, -- null = active session
  actual_rate_charged numeric(10,2),
  notes text,
  player_name text
);
```

Seed at least one venue, one user (linked to an `auth.users` row), and some tables and rates before logging in.

### 4. Register the JWT claims hook

Chalk bakes `venue_id` and `role` into the Supabase JWT at login so server actions never need a profile query.

Run this SQL in your Supabase SQL editor:

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  user_venue_id uuid;
  user_role text;
begin
  select venue_id, role
    into user_venue_id, user_role
    from public.users
   where id = (event->>'user_id')::uuid;

  if user_venue_id is not null then
    event := jsonb_set(event, '{claims,app_metadata,venue_id}', to_jsonb(user_venue_id::text));
  end if;
  if user_role is not null then
    event := jsonb_set(event, '{claims,app_metadata,role}', to_jsonb(user_role));
  end if;

  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

Then go to **Supabase Dashboard → Authentication → Hooks → Custom Access Token Hook** and point it at `public.custom_access_token_hook`.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

---

## How billing works

Amount owed is calculated live on the client and recorded permanently when a session ends.

- The **actual rate charged** is snapshotted from the database at the moment the session starts — changing a rate later does not affect in-progress or historical sessions.
- **League ($15/hr)**: billing uses whole-hour increments from the session start time. At each hour boundary, if that hour's start falls in a peak window, the peak rate ($25/hr) is applied for that hour instead.
- **Non-League ($25/hr)** and **Peak ($25/hr)**: continuous billing — hours × rate, no per-hour boundary logic. Any rate at or above the peak price uses continuous billing.
- During **peak hours** (Friday 8 PM → Sunday 3 AM), the rate selector is hidden and the peak rate is applied automatically.
- The peak rate threshold is derived at runtime from the highest `pricePerHour` across all loaded rates — no hardcoded value.

---

## Project structure

```
src/
  app/
    login/          — Login page, form, server actions
    dashboard/      — Main dashboard page, server actions
  components/
    dashboard/      — Header, TableCard, modals, summary drawer, pool ball
    login/          — Animated wave background
    ui/             — shadcn primitives (Button, Input, Sheet, Card, Label)
    icons/          — Custom SVG icons
  lib/
    pool-types.ts   — Domain types and billing calculation logic
    utils.ts        — Tailwind class merge utility
  utils/supabase/
    server.ts       — Server-side Supabase client (Server Actions)
    client.ts       — Browser-side Supabase client
    middleware.ts   — Auth session updater for route protection
  proxy.ts          — Next.js middleware entry point (route guard)
```

---

## MVP 1 scope

- Email/password login via Supabase Auth
- Live table dashboard with real-time timers and billing
- Start and end sessions with optional player names
- Rate selection with automatic peak-hour enforcement
- Today's revenue summary for owners
- All data scoped to the logged-in user's venue
- Responsive layout (mobile, tablet, desktop)
