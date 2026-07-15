import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient } from "@/test/supabase-mock"

vi.mock("next/server", () => ({
  NextRequest: class {
    _body: unknown
    constructor(url: string, init?: { method?: string; body?: string }) {
      this._body = init?.body ? JSON.parse(init.body) : null
    }
    async json() {
      return this._body
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getProfile: vi.fn() }))
vi.mock("@/lib/billing-table", () => ({ sessionTableTotalCents: vi.fn() }))
vi.mock("@/lib/tax", () => ({
  getVenueTaxRate: vi.fn(),
  computeTaxCents: vi.fn(),
}))
vi.mock("@/lib/snapshot-time", () => ({ resolveSnapshotTime: vi.fn() }))

import { POST } from "@/app/api/sessions/[id]/checkout/confirm/route"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { sessionTableTotalCents } from "@/lib/billing-table"
import { getVenueTaxRate, computeTaxCents } from "@/lib/tax"
import { resolveSnapshotTime } from "@/lib/snapshot-time"

const mockedCreateClient = vi.mocked(createClient)
const mockedGetProfile = vi.mocked(getProfile)
const mockedSessionTableTotalCents = vi.mocked(sessionTableTotalCents)
const mockedGetVenueTaxRate = vi.mocked(getVenueTaxRate)
const mockedComputeTaxCents = vi.mocked(computeTaxCents)
const mockedResolveSnapshotTime = vi.mocked(resolveSnapshotTime)

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const makeRequest = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetProfile.mockResolvedValue({ venueId: "v1", role: "owner", userId: "u1" })
  mockedSessionTableTotalCents.mockResolvedValue(6000)
  mockedGetVenueTaxRate.mockResolvedValue(0.13)
  mockedComputeTaxCents.mockImplementation((subtotal, rate) => Math.round(subtotal * rate))
  mockedResolveSnapshotTime.mockReturnValue(new Date("2026-07-14T15:00:00Z"))
})

/**
 * Build a mock client wired for the full happy-path confirm flow.
 *
 * The route calls `.from("sessions")` three times and `.from("payments")` twice,
 * so those entries use function callbacks that return different results per call.
 */
function buildHappyClient(overrides?: {
  existingPayment?: { id: string; status: string } | null
  insertedPaymentId?: string
  orderItems?: { quantity: number; price_at_time_cents: number }[]
  tableId?: string | null
}) {
  const {
    existingPayment = null,
    insertedPaymentId = "pay1",
    orderItems = [],
    tableId = "t1",
  } = overrides ?? {}

  let sessionCall = 0
  let paymentCall = 0

  return createMockClient({
    tables: {
      sessions: () => {
        sessionCall++
        if (sessionCall === 1) {
          return {
            data: {
              id: "s1",
              venue_id: "v1",
              started_at: "2026-07-14T13:00:00Z",
              actual_rate_charged: 30,
            },
            error: null,
          }
        }
        if (sessionCall === 2) return { data: { table_id: tableId }, error: null }
        return { data: null, error: null }
      },
      order_items: { data: orderItems, error: null },
      payments: () => {
        paymentCall++
        if (paymentCall === 1) {
          return { data: existingPayment, error: null }
        }
        return { data: { id: existingPayment?.id ?? insertedPaymentId }, error: null }
      },
      tables: { data: null, error: null },
    },
  })
}

describe("POST /api/sessions/[id]/checkout/confirm", () => {
  it("computes correct totals (table + items + tax + tip) and returns payment_id", async () => {
    const mockClient = buildHappyClient({
      orderItems: [
        { quantity: 2, price_at_time_cents: 500 },
        { quantity: 1, price_at_time_cents: 350 },
      ],
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)

    const res = await POST(makeRequest({ method: "cash", tip_cents: 200 }), params("s1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.payment_id).toBe("pay1")

    // table=6000, items=2*500+1*350=1350, subtotal=7350, tax=round(7350*0.13)=956, tip=200
    // grand=7350+956+200=8506
    expect(mockedSessionTableTotalCents).toHaveBeenCalledWith(
      expect.anything(),
      "v1",
      "2026-07-14T13:00:00Z",
      30,
      new Date("2026-07-14T15:00:00Z").getTime()
    )
    expect(mockedComputeTaxCents).toHaveBeenCalledWith(7350, 0.13)

    // Verify the insert payload on the payments builder
    const paymentBuilders = mockClient.buildersFor("payments")
    expect(paymentBuilders).toHaveLength(2)
    expect(paymentBuilders[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        venue_id: "v1",
        session_id: "s1",
        method: "cash",
        table_total_cents: 6000,
        items_total_cents: 1350,
        tax_cents: 956,
        tip_cents: 200,
        grand_total_cents: 8506,
        status: "succeeded",
      })
    )
  })

  it("upserts over an existing non-succeeded payment", async () => {
    const mockClient = buildHappyClient({
      existingPayment: { id: "existing-pay", status: "pending" },
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)

    const res = await POST(makeRequest({ method: "cash" }), params("s1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.payment_id).toBe("existing-pay")

    // Second payments builder should use update, not insert
    const paymentBuilders = mockClient.buildersFor("payments")
    expect(paymentBuilders).toHaveLength(2)
    expect(paymentBuilders[1].update).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "cash",
        status: "succeeded",
        stripe_payment_intent_id: null,
      })
    )
  })

  it("inserts a new payment when none exists", async () => {
    const mockClient = buildHappyClient({ existingPayment: null })
    mockedCreateClient.mockResolvedValue(mockClient as never)

    const res = await POST(makeRequest({ method: "cash" }), params("s1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.payment_id).toBe("pay1")

    const paymentBuilders = mockClient.buildersFor("payments")
    expect(paymentBuilders).toHaveLength(2)
    // First call: select (maybeSingle) — no existing payment found
    expect(paymentBuilders[0].maybeSingle).toHaveBeenCalled()
    // Second call: insert
    expect(paymentBuilders[1].insert).toHaveBeenCalled()
  })

  it("returns 404 for session not found or wrong venue", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        tables: {
          sessions: { data: null, error: { message: "not found" } },
        },
      }) as never
    )

    const res = await POST(makeRequest({ method: "cash" }), params("missing"))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Session not found")
  })

  it("returns 400 for invalid body — missing method", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient() as never)

    const res = await POST(makeRequest({ tip_cents: 100 }), params("s1"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 for invalid body — negative tip", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient() as never)

    const res = await POST(makeRequest({ method: "cash", tip_cents: -100 }), params("s1"))
    expect(res.status).toBe(400)
  })

  it("returns 401 when unauthenticated", async () => {
    mockedGetProfile.mockRejectedValue(new Error("Not authenticated"))
    mockedCreateClient.mockResolvedValue(createMockClient() as never)

    const res = await POST(makeRequest({ method: "cash" }), params("s1"))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("closes the session and frees the table after payment", async () => {
    const mockClient = buildHappyClient({ tableId: "t1" })
    mockedCreateClient.mockResolvedValue(mockClient as never)

    await POST(makeRequest({ method: "cash" }), params("s1"))

    // Route calls .from("sessions") 3 times: lookup, get table_id, update ended_at
    const sessionBuilders = mockClient.buildersFor("sessions")
    expect(sessionBuilders).toHaveLength(3)
    expect(sessionBuilders[2].update).toHaveBeenCalledWith(
      expect.objectContaining({ ended_at: "2026-07-14T15:00:00.000Z" })
    )

    // Table should be freed
    const tablesBuilders = mockClient.buildersFor("tables")
    expect(tablesBuilders).toHaveLength(1)
    expect(tablesBuilders[0].update).toHaveBeenCalledWith({ status: "free" })
  })
})
