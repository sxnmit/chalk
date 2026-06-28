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

Tests live next to the code they cover as `*.test.ts` / `*.test.tsx`:

| Area | File | What it covers |
| --- | --- | --- |
| Billing math | `src/lib/pool-types.test.ts` | peak-hour windows, league vs. flat billing, duration/currency formatting |
| Currency | `src/lib/format.test.ts` | `formatCAD` (cents → CAD) |
| Class merging | `src/lib/utils.test.ts` | `cn()` Tailwind conflict resolution |
| Auth / tenancy | `src/lib/auth.test.ts` | `getProfile` JWT claims + DB fallbacks |
| API auth helpers | `src/lib/billing/server.test.ts` | profile resolution, role gating, `apiError`, `absoluteUrl`, subscription summary |
| Subscription rules | `src/lib/billing/types.test.ts` | `hasRole`, blocked-status set |
| Dashboard actions | `src/app/dashboard/actions.test.ts` | venue-scoping guards, rate snapshot on start, table/session assembly |
| Totals API | `src/app/api/sessions/[id]/totals/route.test.ts` | table-time + line-item math, 404/401 paths |
| Components | `src/components/**/*.test.tsx` | `CartTotals`, `PoolBall` rendering |

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

1. Put the test beside the source file (`foo.ts` → `foo.test.ts`).
2. For anything that reads a profile or queries Supabase, `vi.mock` the relevant
   `@/utils/supabase/*` factory and feed results via `createMockClient`.
3. Every server action / route should at minimum cover the happy path plus the
   venue-scoping / auth failure paths — application-level scoping is the only
   multi-tenancy guard while RLS is disabled.
