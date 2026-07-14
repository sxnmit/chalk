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
vi.mock("@/lib/auth", () => ({ getProfile: vi.fn() }))

import { POST } from "@/app/api/sessions/[id]/items/route"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const mockedCreateClient = vi.mocked(createClient)
const mockedGetProfile = vi.mocked(getProfile)
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const makeRequest = (body: unknown) => ({ json: async () => body } as never)

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetProfile.mockResolvedValue({ venueId: "v1", role: "owner", userId: "u1" } as never)
})

describe("POST /api/sessions/[id]/items", () => {
  it("successfully adds an item — returns 201 with data", async () => {
    const rpcData = {
      id: "oi1",
      venue_id: "v1",
      session_id: "s1",
      menu_item_id: VALID_UUID,
      quantity: 2,
      price_at_time_cents: 500,
    }
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        sessions: { data: { id: "s1" }, error: null },
        menu_items: { data: { id: VALID_UUID }, error: null },
      },
    })
    client.rpc = vi.fn().mockResolvedValue({ data: rpcData, error: null })
    mockedCreateClient.mockResolvedValue(client as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 2 }), params("s1"))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(rpcData)
    expect(client.rpc).toHaveBeenCalledWith("add_order_item_with_stock", {
      p_venue_id: "v1",
      p_session_id: "s1",
      p_menu_item_id: VALID_UUID,
      p_quantity: 2,
    })
  })

  it("returns 404 when session not found (wrong id or wrong venue)", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        sessions: { data: null, error: { message: "not found" } },
      },
    })
    mockedCreateClient.mockResolvedValue(client as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 1 }), params("wrong"))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Session not found")
  })

  it("returns 404 when menu item not found or unavailable", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        sessions: { data: { id: "s1" }, error: null },
        menu_items: { data: null, error: { message: "not found" } },
      },
    })
    mockedCreateClient.mockResolvedValue(client as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 1 }), params("s1"))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Menu item not found or unavailable")
  })

  it("returns 409 with 'Item is sold out' when RPC error is INSUFFICIENT_STOCK:0", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        sessions: { data: { id: "s1" }, error: null },
        menu_items: { data: { id: VALID_UUID }, error: null },
      },
    })
    client.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "INSUFFICIENT_STOCK:0" } })
    mockedCreateClient.mockResolvedValue(client as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 5 }), params("s1"))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("Item is sold out")
  })

  it("returns 409 with 'Only 3 left in stock' when RPC error is INSUFFICIENT_STOCK:3", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        sessions: { data: { id: "s1" }, error: null },
        menu_items: { data: { id: VALID_UUID }, error: null },
      },
    })
    client.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "INSUFFICIENT_STOCK:3" } })
    mockedCreateClient.mockResolvedValue(client as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 5 }), params("s1"))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("Only 3 left in stock")
  })

  it("returns 400 for invalid body (missing menu_item_id)", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient() as never)

    const res = await POST(makeRequest({ quantity: 1 }), params("s1"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 for invalid body (quantity < 1)", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient() as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 0 }), params("s1"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid body (non-uuid menu_item_id)", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient() as never)

    const res = await POST(makeRequest({ menu_item_id: "not-a-uuid", quantity: 1 }), params("s1"))
    expect(res.status).toBe(400)
  })

  it("returns 401 when unauthenticated", async () => {
    mockedGetProfile.mockRejectedValue(new Error("Unauthorized"))
    mockedCreateClient.mockResolvedValue(createMockClient({ session: null }) as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 1 }), params("s1"))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 500 for generic non-stock RPC errors", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: {
        sessions: { data: { id: "s1" }, error: null },
        menu_items: { data: { id: VALID_UUID }, error: null },
      },
    })
    client.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "some database error" } })
    mockedCreateClient.mockResolvedValue(client as never)

    const res = await POST(makeRequest({ menu_item_id: VALID_UUID, quantity: 1 }), params("s1"))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internal server error")
  })
})
