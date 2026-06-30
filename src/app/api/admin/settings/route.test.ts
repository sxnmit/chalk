import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

vi.mock("next/server", () => ({
  NextRequest: class {
    _body: unknown
    constructor(url: string, init?: { method?: string; body?: string }) {
      this._body = init?.body ? JSON.parse(init.body) : null
    }
    async json() { return this._body }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))

import { GET, PATCH } from "./route"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)

beforeEach(() => vi.clearAllMocks())

function makeRequest(body: unknown) {
  return { json: async () => body } as never
}

describe("GET /api/admin/settings", () => {
  it("returns the venue tax rate", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: { venues: { data: { tax_rate: 13 }, error: null } },
      }) as never
    )

    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.tax_rate).toBe(13)
  })

  it("returns 403 for non-admin roles", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "staff" }),
      }) as never
    )

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({ session: null }) as never)
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe("PATCH /api/admin/settings", () => {
  it("updates the tax rate", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: { venues: { data: { tax_rate: 13 }, error: null } },
      }) as never
    )

    const res = await PATCH(makeRequest({ tax_rate: 13 }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.tax_rate).toBe(13)
  })

  it("rejects tax rate above 100", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      }) as never
    )

    const res = await PATCH(makeRequest({ tax_rate: 150 }))
    expect(res.status).toBe(400)
  })

  it("rejects negative tax rate", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      }) as never
    )

    const res = await PATCH(makeRequest({ tax_rate: -5 }))
    expect(res.status).toBe(400)
  })

  it("returns 403 for staff role", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "staff" }),
      }) as never
    )

    const res = await PATCH(makeRequest({ tax_rate: 10 }))
    expect(res.status).toBe(403)
  })
})
