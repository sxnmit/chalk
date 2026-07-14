import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient } from "@/test/supabase-mock"

vi.mock("next/server", () => {
  class NextResponse {
    body: unknown
    status: number
    constructor(body: unknown = null, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
    }
    static json(body: unknown, init?: { status?: number }) {
      return new NextResponse(body, init)
    }
  }
  return { NextResponse }
})
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getProfile: vi.fn() }))

import { PATCH, DELETE } from "@/app/api/admin/rates/[id]/route"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const mockedCreateClient = vi.mocked(createClient)
const mockedGetProfile = vi.mocked(getProfile)

type MockResponse = { body: unknown; status: number }

const asProfile = (role: string) =>
  ({ venueId: "v1", role, userId: "u1" }) as Awaited<ReturnType<typeof getProfile>>

const fakeParams = (id: string) => ({ params: Promise.resolve({ id }) })
const makeRequest = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => vi.clearAllMocks())

// ---------------------------------------------------------------------------
// PATCH /api/admin/rates/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/rates/[id]", () => {
  it("updates a rate and returns the updated data", async () => {
    const updatedRate = { id: "r1", label: "League", hourly_rate: 20, is_default: false, active: true }
    const mockClient = createMockClient({
      tables: { rates: { data: updatedRate, error: null } },
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)
    mockedGetProfile.mockResolvedValue(asProfile("owner"))

    const res = (await PATCH(makeRequest({ label: "League", hourly_rate: 20 }), fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(200)
    expect(res.body).toEqual(updatedRate)
  })

  it("unsets default on other rates when is_default is true", async () => {
    const updatedRate = { id: "r1", label: "League", hourly_rate: 15, is_default: true, active: true }
    const mockClient = createMockClient({
      tables: { rates: { data: updatedRate, error: null } },
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)
    mockedGetProfile.mockResolvedValue(asProfile("owner"))

    const res = (await PATCH(makeRequest({ is_default: true }), fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(200)
    // Two calls to from("rates"): unset-default + actual update
    const ratesBuilders = mockClient.buildersFor("rates")
    expect(ratesBuilders).toHaveLength(2)
    expect(ratesBuilders[0].update).toHaveBeenCalledWith({ is_default: false })
  })

  it("returns 403 for staff role", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({}) as never)
    mockedGetProfile.mockResolvedValue(asProfile("staff"))

    const res = (await PATCH(makeRequest({ label: "Cheap" }), fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(403)
    expect((res.body as { error: string }).error).toBe("Forbidden")
  })

  it("returns 400 for invalid body (hourly_rate > 999.99)", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({}) as never)
    mockedGetProfile.mockResolvedValue(asProfile("owner"))

    const res = (await PATCH(makeRequest({ hourly_rate: 1000 }), fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/rates/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/admin/rates/[id]", () => {
  it("hard-deletes when no sessions reference the rate", async () => {
    let ratesCallCount = 0
    const mockClient = createMockClient({
      tables: {
        rates: () => {
          ratesCallCount++
          if (ratesCallCount === 1) return { data: { id: "r1" }, error: null }
          return { data: null, error: null }
        },
        tables: { data: [], error: null },
        sessions: { data: null, error: null, count: 0 },
      },
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)
    mockedGetProfile.mockResolvedValue(asProfile("owner"))

    const res = (await DELETE({} as never, fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(204)
    const ratesBuilders = mockClient.buildersFor("rates")
    expect(ratesBuilders).toHaveLength(2)
    expect(ratesBuilders[1].delete).toHaveBeenCalled()
  })

  it("soft-deletes (active: false) when sessions reference the rate", async () => {
    let ratesCallCount = 0
    const mockClient = createMockClient({
      tables: {
        rates: () => {
          ratesCallCount++
          if (ratesCallCount === 1) return { data: { id: "r1" }, error: null }
          return { data: null, error: null }
        },
        tables: { data: [], error: null },
        sessions: { data: null, error: null, count: 3 },
      },
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)
    mockedGetProfile.mockResolvedValue(asProfile("owner"))

    const res = (await DELETE({} as never, fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(204)
    const ratesBuilders = mockClient.buildersFor("rates")
    expect(ratesBuilders).toHaveLength(2)
    expect(ratesBuilders[1].update).toHaveBeenCalledWith({ active: false })
  })

  it("returns 409 with table names when tables use this rate as default", async () => {
    const mockClient = createMockClient({
      tables: {
        rates: { data: { id: "r1" }, error: null },
        tables: { data: [{ name: "Table 1" }, { name: "Table 2" }], error: null },
      },
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)
    mockedGetProfile.mockResolvedValue(asProfile("owner"))

    const res = (await DELETE({} as never, fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(409)
    expect((res.body as { error: string }).error).toContain("Table 1")
    expect((res.body as { error: string }).error).toContain("Table 2")
  })

  it("returns 404 for rate not in venue", async () => {
    const mockClient = createMockClient({
      tables: {
        rates: { data: null, error: null },
      },
    })
    mockedCreateClient.mockResolvedValue(mockClient as never)
    mockedGetProfile.mockResolvedValue(asProfile("owner"))

    const res = (await DELETE({} as never, fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(404)
    expect((res.body as { error: string }).error).toBe("Not found")
  })

  it("returns 403 for staff role", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({}) as never)
    mockedGetProfile.mockResolvedValue(asProfile("staff"))

    const res = (await DELETE({} as never, fakeParams("r1"))) as MockResponse

    expect(res.status).toBe(403)
    expect((res.body as { error: string }).error).toBe("Forbidden")
  })
})
