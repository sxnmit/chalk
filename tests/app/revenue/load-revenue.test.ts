import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { loadRevenueData } from "@/app/revenue/actions"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)

const venueRow = { data: { timezone: "UTC", currency: "CAD" }, error: null }

const paymentRow = {
  id: "p1",
  grand_total_cents: 10000,
  table_total_cents: 8000,
  items_total_cents: 1000,
  tax_cents: 1000,
  tip_cents: 0,
  method: "cash",
  sessions: { started_at: "2026-06-15T14:00:00Z", ended_at: "2026-06-15T15:00:00Z", rates: { label: "League" } },
}

beforeEach(() => vi.clearAllMocks())

describe("loadRevenueData — refund netting", () => {
  it("nets refunds out of total revenue while keeping gross and the breakdown intact", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        venues: venueRow,
        payments: { data: [paymentRow], error: null },
        refunds: { data: [{ amount_cents: 2500 }], error: null },
      },
    })
    mockedCreateClient.mockResolvedValue(client as never)

    const data = await loadRevenueData("2026-06-15", "2026-06-15")

    expect(data.grossRevenue).toBe(100) // $100 collected (grand − tip)
    expect(data.refundsTotal).toBe(25) // $25 refunded
    expect(data.totalRevenue).toBe(75) // net = gross − refunds
    // Breakdown stays gross so it still describes the sale's composition.
    expect(data.tableRevenue).toBe(80)
    expect(data.itemsRevenue).toBe(10)
    expect(data.taxCollected).toBe(10)

    // Gross query includes fully-refunded payments, not just succeeded ones.
    const paymentsBuilder = client.buildersFor("payments")[0]
    expect(paymentsBuilder.in).toHaveBeenCalledWith("status", ["succeeded", "refunded"])
    // Refunds are fetched for exactly the in-range payment ids, venue-scoped.
    const refundsBuilder = client.buildersFor("refunds")[0]
    expect(refundsBuilder.eq).toHaveBeenCalledWith("venue_id", "v1")
    expect(refundsBuilder.in).toHaveBeenCalledWith("payment_id", ["p1"])
  })

  it("reports zero refunds (total === gross) when there are none", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        venues: venueRow,
        payments: { data: [paymentRow], error: null },
        refunds: { data: [], error: null },
      },
    })
    mockedCreateClient.mockResolvedValue(client as never)

    const data = await loadRevenueData("2026-06-15", "2026-06-15")
    expect(data.refundsTotal).toBe(0)
    expect(data.totalRevenue).toBe(data.grossRevenue)
    expect(data.totalRevenue).toBe(100)
  })

  it("skips the refunds query entirely when no payments are in range", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "manager" }),
      tables: {
        venues: venueRow,
        payments: { data: [], error: null },
        refunds: { data: [], error: null },
      },
    })
    mockedCreateClient.mockResolvedValue(client as never)

    const data = await loadRevenueData("2026-06-15", "2026-06-15")
    expect(data.totalRevenue).toBe(0)
    expect(data.refundsTotal).toBe(0)
    expect(client.buildersFor("refunds")).toHaveLength(0)
  })
})
