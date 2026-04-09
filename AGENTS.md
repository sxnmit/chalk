<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Note: `middleware.ts` has been renamed to `proxy.ts` and `export function middleware()` is now `export function proxy()`.
<!-- END:nextjs-agent-rules -->

---

# Project: Chalk — Pool Hall Management SaaS

## Tech Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS)
- Supabase (Postgres, Auth, real-time)
- shadcn/ui
- Vercel

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
  role text -- 'owner' or 'staff'
  created_at timestamptz
)

tables (
  id uuid primary key,
  venue_id uuid references venues(id),
  name text,
  size text, -- '9ft' or 'bar_box'
  status text, -- 'free', 'occupied', 'inactive'
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
  table_id uuid references tables(id),
  rate_id uuid references rates(id),
  staff_id uuid references users(id),
  started_at timestamptz,
  ended_at timestamptz, -- null means session is active
  actual_rate_charged numeric(10,2),
  notes text,
  player_name text
)
```

## Seeded Data (Shy Lounge)
- 1 venue: Shy Lounge
- 2 tables: Table 1, Table 2 (both 9ft)
- 3 rates: League ($10/hr), Non-League ($20/hr), Peak ($25/hr)
- 1 owner account: Vish

## Key Conventions
- Active session = `sessions` row where `ended_at` is null
- Always snapshot `actual_rate_charged` on the session row — never recalculate from the rate table
- RLS is currently disabled for development — do not enable without explicit instruction
- No test suite until v2