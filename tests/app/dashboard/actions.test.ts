import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))

import { loadDashboardData, startSessionAction, endSessionAction } from "@/app/dashboard/actions"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)
const ownerSession = makeSession("u1", { venue_id: "v1", role: "owner" })

function withClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-28T18:00:00Z"))
})
afterEach(() => vi.useRealTimers())

describe("loadDashboardData", () => {
  it("assembles tables with their active sessions and maps rates", async () => {
    withClient(
      createMockClient({
        session: ownerSession,
        tables: {
          tables: {
            data: [
              { id: "t1", name: "Table 1", display_order: 1 },
              { id: "t2", name: "Table 2", display_order: 2 },
            ],
            error: null,
          },
          sessions: {
            data: [
              {
                id: "s1",
                table_id: "t1",
                rate_id: "r2",
                started_at: "2026-06-28T16:00:00Z",
                ended_at: "2026-06-28T18:00:00Z",
                player_name: "Alice",
                actual_rate_charged: 25,
              },
            ],
            error: null,
          },
          rates: {
            data: [
              { id: "r1", label: "League", hourly_rate: 15, is_default: true, active: true },
              { id: "r2", label: "Peak", hourly_rate: 25, is_default: false, active: false },
            ],
            error: null,
          },
          venues: { data: { timezone: "America/New_York", name: "Shy Lounge" }, error: null },
        },
      })
    )

    const result = await loadDashboardData()

    expect(result.userRole).toBe("owner")
    expect(result.venueName).toBe("Shy Lounge")

    // Table 1 is occupied (has the active session), Table 2 is free.
    expect(result.tables).toHaveLength(2)
    expect(result.tables[0].session?.playerName).toBe("Alice")
    expect(result.tables[1].session).toBeUndefined()

    // Active rate kept; deactivated "Peak" rate retained because an active
    // session still references it, and flagged as a peak rate by its label.
    const peak = result.rates.find((r) => r.id === "r2")
    expect(peak).toMatchObject({ name: "Peak", isPeakRate: true, isActive: false })
    expect(result.rates.find((r) => r.id === "r1")).toMatchObject({ isActive: true })

    expect(result.todayCompletedSessionsCount).toBe(1)
    // 2 hours (16:00→18:00) at the snapshotted $25/hr rate, no order items configured.
    expect(result.todayRevenue).toBe(50)
  })

  it("sums order items onto the occupied table's session", async () => {
    withClient(
      createMockClient({
        session: ownerSession,
        tables: {
          tables: {
            data: [{ id: "t1", name: "Table 1", display_order: 1 }],
            error: null,
          },
          sessions: {
            data: [
              {
                id: "s1",
                table_id: "t1",
                rate_id: "r1",
                started_at: "2026-06-28T16:00:00Z",
                ended_at: null,
                player_name: "Alice",
                actual_rate_charged: 15,
              },
            ],
            error: null,
          },
          rates: {
            data: [{ id: "r1", label: "League", hourly_rate: 15, is_default: true, active: true }],
            error: null,
          },
          venues: { data: { timezone: "America/New_York", name: "Shy Lounge" }, error: null },
          order_items: {
            data: [
              { session_id: "s1", quantity: 2, price_at_time_cents: 1200 },
              { session_id: "s1", quantity: 2, price_at_time_cents: 150 },
            ],
            error: null,
          },
        },
      })
    )

    const result = await loadDashboardData()

    expect(result.tables[0].session?.itemsTotalCents).toBe(2700)
  })
})

describe("startSessionAction", () => {
  const validVenue = {
    session: ownerSession,
    tables: {
      tables: { data: { id: "t1" }, error: null },
      rates: { data: { hourly_rate: 15 }, error: null },
      sessions: { error: null },
    },
  }

  it("snapshots the rate onto the inserted session and occupies the table", async () => {
    const client = withClient(createMockClient(validVenue))
    await startSessionAction("t1", "r1", "Bob")

    const insert = client.buildersFor("sessions")[0].insert as ReturnType<typeof vi.fn>
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        table_id: "t1",
        rate_id: "r1",
        venue_id: "v1",
        staff_id: "u1",
        actual_rate_charged: 15,
        player_name: "Bob",
      })
    )
  })

  it("rejects a table that does not belong to the venue", async () => {
    withClient(
      createMockClient({
        session: ownerSession,
        tables: {
          tables: { data: null, error: { message: "no rows" } },
          rates: { data: { hourly_rate: 15 }, error: null },
        },
      })
    )
    await expect(startSessionAction("other-venue-table", "r1")).rejects.toThrow(
      "Table not found for this venue"
    )
  })

  it("rejects a rate that does not belong to the venue", async () => {
    withClient(
      createMockClient({
        session: ownerSession,
        tables: {
          tables: { data: { id: "t1" }, error: null },
          rates: { data: null, error: { message: "no rows" } },
        },
      })
    )
    await expect(startSessionAction("t1", "other-venue-rate")).rejects.toThrow(
      "Rate not found for this venue"
    )
  })

  it("stores null player name when none is provided", async () => {
    const client = withClient(createMockClient(validVenue))
    await startSessionAction("t1", "r1")
    const insert = client.buildersFor("sessions")[0].insert as ReturnType<typeof vi.fn>
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ player_name: null }))
  })

  it("throws when unauthenticated", async () => {
    withClient(createMockClient({ session: null }))
    await expect(startSessionAction("t1", "r1")).rejects.toThrow("Not authenticated")
  })
})

describe("endSessionAction", () => {
  it("ends the session when the table belongs to the venue", async () => {
    const client = withClient(
      createMockClient({
        session: ownerSession,
        tables: {
          tables: { data: { id: "t1" }, error: null },
          sessions: { error: null },
        },
      })
    )
    await expect(endSessionAction("t1")).resolves.toBeUndefined()

    // Table flipped back to free.
    const tableUpdate = client.buildersFor("tables")
    expect(tableUpdate.some((b) => (b.update as ReturnType<typeof vi.fn>).mock.calls.length > 0)).toBe(
      true
    )
  })

  it("rejects a table from another venue", async () => {
    withClient(
      createMockClient({
        session: ownerSession,
        tables: { tables: { data: null, error: { message: "no rows" } } },
      })
    )
    await expect(endSessionAction("foreign-table")).rejects.toThrow("Table not found for this venue")
  })
})
