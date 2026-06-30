# Testing

Unit / integration tests run on [Vitest](https://vitest.dev) with the
`happy-dom` environment for component rendering.

## Commands

```bash
npm test            # run the whole suite once
npm run test:watch  # watch mode
npm run test:coverage  # text + HTML coverage report (coverage/)
```

## Layout

Tests live in a top-level `tests/` folder that mirrors `src/`:

| Area | File | What it covers |
| --- | --- | --- |
| Billing math | `tests/lib/pool-types.test.ts` | peak-hour windows, league vs. flat billing, duration/currency formatting |
| Currency | `tests/lib/format.test.ts` | `formatCAD` (cents → CAD) |
| Class merging | `tests/lib/utils.test.ts` | `cn()` Tailwind conflict resolution |
| Auth / tenancy | `tests/lib/auth.test.ts` | `getProfile` JWT claims + DB fallbacks |
| API auth helpers | `tests/lib/billing/server.test.ts` | profile resolution, role gating, `apiError`, `absoluteUrl`, subscription summary |
| Subscription rules | `tests/lib/billing/types.test.ts` | `hasRole`, blocked-status set |
| Dashboard actions | `tests/app/dashboard/actions.test.ts` | venue-scoping guards, rate snapshot on start, table/session assembly |
| Totals API | `tests/app/api/sessions/[id]/totals/route.test.ts` | table-time + line-item math, 404/401 paths |
| Role gating | `tests/role-gating.test.ts` | owner/manager/staff enforcement on `/api/menu`, `/api/admin/tables`, `/api/admin/rates` |
| Components | `tests/components/**/*.test.tsx` | `CartTotals`, `PoolBall` rendering |

## Conventions

- **Deterministic time/zone.** `vitest.config.ts` pins `TZ=America/New_York` so
  the peak-hour and business-day logic is reproducible everywhere. Tests that
  depend on "now" use `vi.useFakeTimers()` + `vi.setSystemTime(...)`.
- **Supabase is mocked**, never hit live. Use the shared helper in
  `src/test/supabase-mock.ts`:
  - `createMockClient({ session, tables })` — fakes `.from(table)` (chainable,
    awaitable, with `.single()`/`.maybeSingle()` terminals) and
    `auth.getSession()`.
  - `makeSession(userId, appMetadata)` — forges a JWT whose `app_metadata`
    carries `venue_id` / `role` claims, matching the custom access-token hook.
  - `client.buildersFor(table)` — inspect the query builders opened for a table
    to assert on `.insert(...)` / `.update(...)` payloads.

## Adding tests

1. Mirror the source path under `tests/` (e.g. `src/lib/foo.ts` →
   `tests/lib/foo.test.ts`). Import the module under test with the `@/` alias.
2. For anything that reads a profile or queries Supabase, `vi.mock` the relevant
   `@/utils/supabase/*` factory and feed results via `createMockClient`. To
   vary the caller's role without re-wiring Supabase, `vi.mock("@/lib/auth", () => ({ getProfile: vi.fn() }))`
   and set the resolved value per test — see `tests/role-gating.test.ts`.
3. Every server action / route should at minimum cover the happy path plus the
   venue-scoping / auth failure paths — application-level scoping is the only
   multi-tenancy guard while RLS is disabled.
4. For any new route that gates on `role`, add a case to `tests/role-gating.test.ts`
   asserting that `staff` is rejected with 403 and `owner` (and `manager` where
   applicable) is not.
