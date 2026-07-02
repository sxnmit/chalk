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

const INVITE = {
  id: "inv1",
  email: "test@example.com",
  role: "staff",
  created_at: "2026-07-01T00:00:00Z",
  expires_at: "2026-07-08T00:00:00Z",
}

function ownerSession() {
  mockedCreateClient.mockResolvedValue(
    createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
    }) as never
  )
}

function adminWithInvite(invite: typeof INVITE | null = INVITE) {
  let callCount = 0
  mockedCreateAdminClient.mockReturnValue(
    createMockClient({
      tables: {
        venue_invites: () => {
          callCount++
          // First call: lookup, second call: delete
          if (callCount === 1) return { data: invite, error: null }
          return { data: null, error: null }
        },
        audit_log: { data: null, error: null },
      },
    }) as never
  )
}

beforeEach(() => vi.clearAllMocks())

describe("DELETE /api/team/invite/[inviteId]", () => {
  it("deletes the invite and returns ok", async () => {
    ownerSession()
    adminWithInvite()

    const res = await DELETE({} as never, params("inv1"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const adminClient = mockedCreateAdminClient.mock.results[0].value
    const inviteBuilders = adminClient.buildersFor("venue_invites")
    expect(inviteBuilders).toHaveLength(2)
    // Second call is the delete
    expect(inviteBuilders[1].delete).toHaveBeenCalled()
    expect(inviteBuilders[1].eq).toHaveBeenCalledWith("id", "inv1")
    expect(inviteBuilders[1].eq).toHaveBeenCalledWith("venue_id", "v1")
  })

  it("writes an audit log entry on successful revoke", async () => {
    ownerSession()
    adminWithInvite()

    await DELETE({} as never, params("inv1"))

    const adminClient = mockedCreateAdminClient.mock.results[0].value
    expect(adminClient.from).toHaveBeenCalledWith("audit_log")
    const auditBuilder = adminClient.buildersFor("audit_log")[0]
    expect(auditBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        venue_id: "v1",
        actor_id: "u1",
        actor_role: "owner",
        entity_type: "venue_invite",
        entity_id: "inv1",
        operation: "revoke",
        before: INVITE,
      })
    )
  })

  it("returns 404 when the invite does not exist", async () => {
    ownerSession()
    adminWithInvite(null)

    const res = await DELETE({} as never, params("missing"))
    expect(res.status).toBe(404)
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

  it("returns 500 when the database lookup fails", async () => {
    ownerSession()
    mockedCreateAdminClient.mockReturnValue(
      createMockClient({
        tables: { venue_invites: { data: null, error: { message: "db error" } } },
      }) as never
    )

    const res = await DELETE({} as never, params("inv1"))
    expect(res.status).toBe(500)
  })
})
