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
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { DELETE } from "@/app/api/team/invite/[inviteId]/route"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)
const params = (inviteId: string) => ({ params: Promise.resolve({ inviteId }) })

beforeEach(() => vi.clearAllMocks())

describe("DELETE /api/team/invite/[inviteId]", () => {
  it("deletes the invite and returns ok", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      }) as never
    )
    mockedCreateAdminClient.mockReturnValue(
      createMockClient({
        tables: { venue_invites: { data: null, error: null } },
      }) as never
    )

    const res = await DELETE({} as never, params("inv1"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const adminClient = mockedCreateAdminClient.mock.results[0].value
    expect(adminClient.from).toHaveBeenCalledWith("venue_invites")
    const builder = adminClient.buildersFor("venue_invites")[0]
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith("id", "inv1")
    expect(builder.eq).toHaveBeenCalledWith("venue_id", "v1")
  })

  it("returns 403 for manager role", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "manager" }),
      }) as never
    )

    const res = await DELETE({} as never, params("inv1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for staff role", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "staff" }),
      }) as never
    )

    const res = await DELETE({} as never, params("inv1"))
    expect(res.status).toBe(403)
  })

  it("returns 401 when unauthenticated", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({ session: null }) as never)

    const res = await DELETE({} as never, params("inv1"))
    expect(res.status).toBe(401)
  })

  it("returns 500 when the database delete fails", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      }) as never
    )
    mockedCreateAdminClient.mockReturnValue(
      createMockClient({
        tables: { venue_invites: { data: null, error: { message: "db error" } } },
      }) as never
    )

    const res = await DELETE({} as never, params("inv1"))
    expect(res.status).toBe(500)
  })
})
