import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))

import { GET } from "./route"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe("GET /api/sessions/[id]/totals", () => {
  it("computes table time from elapsed hours and aggregates order items", async () => {
    // Session started two hours before "now" at $30/hr → $60.00 = 6000 cents.
    vi.setSystemTime(new Date("2026-06-28T14:00:00Z"))
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: {
          sessions: {
            data: {
              id: "s1",
              venue_id: "v1",
              started_at: "2026-06-28T12:00:00Z",
              actual_rate_charged: 30,
            },
            error: null,
          },
          order_items: {
            data: [
              { id: "oi1", menu_item_id: "m1", quantity: 2, price_at_time_cents: 500, menu_items: { name: "Wings" } },
              { id: "oi2", menu_item_id: "m2", quantity: 1, price_at_time_cents: 350, menu_items: { name: "Soda" } },
            ],
            error: null,
          },
        },
      }) as never
    )

    const res = await GET({} as never, params("s1"))
    const body = await res.json()

    expect(body.table_total_cents).toBe(6000)
    expect(body.items_total_cents).toBe(1350) // 2*500 + 1*350
    expect(body.grand_total_cents).toBe(7350)
    expect(body.order_items).toHaveLength(2)
    expect(body.order_items[0]).toMatchObject({ name: "Wings", line_total_cents: 1000 })
  })

  it("returns 404 when the session is not found", async () => {
    vi.setSystemTime(new Date("2026-06-28T14:00:00Z"))
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: { sessions: { data: null, error: { message: "not found" } } },
      }) as never
    )

    const res = await GET({} as never, params("missing"))
    expect(res.status).toBe(404)
  })

  it("handles a session with no order items", async () => {
    vi.setSystemTime(new Date("2026-06-28T13:00:00Z"))
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: {
          sessions: {
            data: { id: "s1", venue_id: "v1", started_at: "2026-06-28T12:00:00Z", actual_rate_charged: 20 },
            error: null,
          },
          order_items: { data: [], error: null },
        },
      }) as never
    )

    const res = await GET({} as never, params("s1"))
    const body = await res.json()
    expect(body.table_total_cents).toBe(2000) // 1h * $20
    expect(body.items_total_cents).toBe(0)
    expect(body.order_items).toEqual([])
  })

  it("returns 401 when the profile lookup throws (unauthenticated)", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({ session: null }) as never)
    const res = await GET({} as never, params("s1"))
    expect(res.status).toBe(401)
  })
})
