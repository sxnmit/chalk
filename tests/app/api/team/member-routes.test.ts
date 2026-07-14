import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient } from "@/test/supabase-mock"

// --- Mocks ---

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock("@/lib/billing/server", () => {
  class HttpError extends Error {
    constructor(public status: number, message: string) {
      super(message)
    }
  }
  return {
    requireRole: vi.fn(),
    apiError: vi.fn((e: unknown) => {
      if (e instanceof HttpError) {
        return { body: { error: (e as HttpError).message }, status: (e as HttpError).status }
      }
      return { body: { error: "Internal server error" }, status: 500 }
    }),
    HttpError,
  }
})

vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { DELETE } from "@/app/api/team/[memberId]/route"
import { PATCH } from "@/app/api/team/[memberId]/role/route"
import { requireRole, HttpError } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedRequireRole = vi.mocked(requireRole)
const mockedCreateAdminClient = vi.mocked(createAdminClient)

const PROFILE = { venueId: "v1", userId: "u1", role: "owner" as const }

const fakeParams = (id: string) => ({ params: Promise.resolve({ memberId: id }) })
const makeRequest = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  mockedRequireRole.mockResolvedValue({ profile: PROFILE } as never)
})

// ---------------------------------------------------------------------------
// DELETE /api/team/[memberId]
// ---------------------------------------------------------------------------

describe("DELETE /api/team/[memberId]", () => {
  it("removes a non-owner member successfully", async () => {
    const client = createMockClient({
      tables: {
        venue_members: () => ({
          data: { id: "m1", user_id: "other-user", role: "staff" },
          error: null,
        }),
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await DELETE(null as never, fakeParams("m1"))) as unknown as {
      body: { ok: boolean }
      status: number
    }

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it("blocks self-removal", async () => {
    const client = createMockClient({
      tables: {
        venue_members: () => ({
          data: { id: "m1", user_id: "u1", role: "owner" },
          error: null,
        }),
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await DELETE(null as never, fakeParams("m1"))) as unknown as {
      body: { error: string }
      status: number
    }

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: "You cannot remove yourself" })
  })

  it("blocks removing the last owner", async () => {
    let callCount = 0
    const client = createMockClient({
      tables: {
        venue_members: () => {
          callCount++
          if (callCount === 1) {
            return {
              data: { id: "m2", user_id: "other-owner", role: "owner" },
              error: null,
            }
          }
          // owner count query
          return { data: null, error: null, count: 1 }
        },
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await DELETE(null as never, fakeParams("m2"))) as unknown as {
      body: { error: string }
      status: number
    }

    expect(res.status).toBe(400)
    expect(res.body.error).toContain("Cannot remove the last owner")
  })

  it("allows removing an owner when another owner exists", async () => {
    let callCount = 0
    const client = createMockClient({
      tables: {
        venue_members: () => {
          callCount++
          if (callCount === 1) {
            return {
              data: { id: "m2", user_id: "other-owner", role: "owner" },
              error: null,
            }
          }
          if (callCount === 2) {
            // owner count query - 2 owners exist
            return { data: null, error: null, count: 2 }
          }
          // delete call
          return { data: null, error: null }
        },
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await DELETE(null as never, fakeParams("m2"))) as unknown as {
      body: { ok: boolean }
      status: number
    }

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it("returns error for non-owner callers", async () => {
    mockedRequireRole.mockRejectedValue(new HttpError(403, "Insufficient permissions"))

    const res = (await DELETE(null as never, fakeParams("m1"))) as unknown as {
      body: { error: string }
      status: number
    }

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: "Insufficient permissions" })
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/team/[memberId]/role
// ---------------------------------------------------------------------------

describe("PATCH /api/team/[memberId]/role", () => {
  it("updates a member's role successfully", async () => {
    const client = createMockClient({
      tables: {
        venue_members: () => ({
          data: { id: "m1", user_id: "other-user", role: "staff" },
          error: null,
        }),
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await PATCH(
      makeRequest({ role: "manager" }),
      fakeParams("m1")
    )) as unknown as { body: { ok: boolean }; status: number }

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it("blocks self-demotion from owner", async () => {
    const client = createMockClient({
      tables: {
        venue_members: () => ({
          data: { id: "m1", user_id: "u1", role: "owner" },
          error: null,
        }),
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await PATCH(
      makeRequest({ role: "staff" }),
      fakeParams("m1")
    )) as unknown as { body: { error: string }; status: number }

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: "You cannot remove your own owner role" })
  })

  it("blocks demoting the last owner", async () => {
    let callCount = 0
    const client = createMockClient({
      tables: {
        venue_members: () => {
          callCount++
          if (callCount === 1) {
            return {
              data: { id: "m2", user_id: "other-owner", role: "owner" },
              error: null,
            }
          }
          // owner count query
          return { data: null, error: null, count: 1 }
        },
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await PATCH(
      makeRequest({ role: "manager" }),
      fakeParams("m2")
    )) as unknown as { body: { error: string }; status: number }

    expect(res.status).toBe(400)
    expect(res.body.error).toContain("Cannot demote the last owner")
  })

  it("allows demoting an owner when another exists", async () => {
    let callCount = 0
    const client = createMockClient({
      tables: {
        venue_members: () => {
          callCount++
          if (callCount === 1) {
            return {
              data: { id: "m2", user_id: "other-owner", role: "owner" },
              error: null,
            }
          }
          if (callCount === 2) {
            // owner count query - 2 owners exist
            return { data: null, error: null, count: 2 }
          }
          // update call
          return { data: null, error: null }
        },
      },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = (await PATCH(
      makeRequest({ role: "manager" }),
      fakeParams("m2")
    )) as unknown as { body: { ok: boolean }; status: number }

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it("returns 400 for invalid role value", async () => {
    const res = (await PATCH(
      makeRequest({ role: "superadmin" }),
      fakeParams("m1")
    )) as unknown as { body: { error: string }; status: number }

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: "Invalid role" })
  })
})
