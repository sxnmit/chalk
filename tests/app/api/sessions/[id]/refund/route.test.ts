import { describe, it, expect, beforeEach, vi } from "vitest"
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
// billing/server.ts (via requireRole) imports createAdminClient -> "server-only",
// which doesn't resolve under vitest. Mock it (same as the team-invite tests).
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { POST } from "@/app/api/sessions/[id]/refund/route"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const makeRequest = (body: unknown) => ({ json: async () => body } as never)

const VALID_PAYMENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

/** Build an owner/manager client whose payments lookup + process_refund RPC succeed. */
function buildClient(opts?: {
  role?: "owner" | "manager" | "staff"
  payment?: { id: string; status: string } | null
  rpcResult?: { data?: unknown; error?: { message: string } | null }
}) {
  const {
    role = "owner",
    payment = { id: VALID_PAYMENT_ID, status: "succeeded" },
    rpcResult = { data: { id: "ref1", amount_cents: 500 }, error: null },
  } = opts ?? {}

  const client = createMockClient({
    session: makeSession("u1", { venue_id: "v1", role }),
    tables: { payments: { data: payment, error: null } },
  })
  client.rpc = vi.fn((name: string) => {
    if (name === "set_audit_context") return Promise.resolve({ error: null })
    return Promise.resolve(rpcResult)
  }) as never
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

const goodBody = { payment_id: VALID_PAYMENT_ID, amount_cents: 500, reason: "mis-ring" }

beforeEach(() => vi.clearAllMocks())

describe("POST /api/sessions/[id]/refund", () => {
  it("records a partial refund and calls process_refund with venue-scoped params", async () => {
    const client = buildClient()

    const res = await POST(makeRequest(goodBody), params("s1"))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.refund).toEqual({ id: "ref1", amount_cents: 500 })

    // venue_id and actor come from the profile (JWT), never the body.
    expect(client.rpc).toHaveBeenCalledWith("process_refund", {
      p_venue_id: "v1",
      p_payment_id: VALID_PAYMENT_ID,
      p_amount_cents: 500,
      p_reason: "mis-ring",
      p_kind: "refund",
      p_actor: "u1",
      p_audit_context: { reason: "mis-ring", kind: "refund", payment_id: VALID_PAYMENT_ID, amount_cents: 500 },
    })
  })

  it("attaches the reason via the audit context substrate (set_audit_context)", async () => {
    const client = buildClient()
    await POST(makeRequest(goodBody), params("s1"))
    expect(client.rpc).toHaveBeenCalledWith("set_audit_context", {
      ctx: { reason: "mis-ring", kind: "refund", payment_id: VALID_PAYMENT_ID, amount_cents: 500 },
    })
  })

  it("validates the payment belongs to this session and venue", async () => {
    const client = buildClient()
    await POST(makeRequest(goodBody), params("s1"))
    const b = client.buildersFor("payments")[0]
    expect(b.eq).toHaveBeenCalledWith("id", VALID_PAYMENT_ID)
    expect(b.eq).toHaveBeenCalledWith("session_id", "s1")
    expect(b.eq).toHaveBeenCalledWith("venue_id", "v1")
  })

  it("allows a manager to refund", async () => {
    buildClient({ role: "manager" })
    const res = await POST(makeRequest(goodBody), params("s1"))
    expect(res.status).toBe(201)
  })

  it("forbids staff (403)", async () => {
    buildClient({ role: "staff" })
    const res = await POST(makeRequest(goodBody), params("s1"))
    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({ session: null }) as never)
    const res = await POST(makeRequest(goodBody), params("s1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when the payment is not found / wrong session", async () => {
    buildClient({ payment: null })
    const res = await POST(makeRequest(goodBody), params("s1"))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Payment not found")
  })

  it("returns 400 for a missing reason", async () => {
    buildClient()
    const res = await POST(makeRequest({ payment_id: VALID_PAYMENT_ID, amount_cents: 500 }), params("s1"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for a non-positive amount", async () => {
    buildClient()
    const res = await POST(
      makeRequest({ payment_id: VALID_PAYMENT_ID, amount_cents: 0, reason: "x" }),
      params("s1")
    )
    expect(res.status).toBe(400)
  })

  it("maps REFUND_EXCEEDS_REMAINING to a 400 with the remaining balance", async () => {
    buildClient({ rpcResult: { data: null, error: { message: "REFUND_EXCEEDS_REMAINING:5000" } } })
    const res = await POST(makeRequest(goodBody), params("s1"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("50.00") // $50.00 remaining
  })

  it("maps VOID_MUST_BE_FULL to a 400", async () => {
    buildClient({ rpcResult: { data: null, error: { message: "VOID_MUST_BE_FULL:8506" } } })
    const res = await POST(
      makeRequest({ payment_id: VALID_PAYMENT_ID, amount_cents: 500, reason: "walkout", kind: "void" }),
      params("s1")
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("85.06")
  })

  it("maps PAYMENT_NOT_REFUNDABLE to a 409", async () => {
    buildClient({ rpcResult: { data: null, error: { message: "PAYMENT_NOT_REFUNDABLE" } } })
    const res = await POST(makeRequest(goodBody), params("s1"))
    expect(res.status).toBe(409)
  })

  it("never leaks a raw DB error — generic RPC failures become a 500", async () => {
    buildClient({ rpcResult: { data: null, error: { message: 'duplicate key value violates constraint "x"' } } })
    const res = await POST(makeRequest(goodBody), params("s1"))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internal server error")
  })
})
