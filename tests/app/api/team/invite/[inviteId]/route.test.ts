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
// billing/server.ts (imported transitively via requireRole) pulls in
// createAdminClient, which imports "server-only" — that doesn't resolve
// under vitest, so this module must stay mocked even though this route no
// longer calls createAdminClient itself.
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { DELETE } from "@/app/api/team/invite/[inviteId]/route"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)
const params = (inviteId: string) => ({ params: Promise.resolve({ inviteId }) })

const INVITE = {
  id: "inv1",
  email: "test@example.com",
  role: "staff",
  created_at: "2026-07-01T00:00:00Z",
  expires_at: "2026-07-08T00:00:00Z",
}

// The route now does the lookup + delete through the caller's own
// JWT-scoped client (not the admin client), so the audit_venue_invites
// trigger can attribute the row to this owner via auth.uid().
function ownerClientWithInvite(invite: typeof INVITE | null = INVITE) {
  let callCount = 0
  const client = createMockClient({
    session: makeSession("u1", { venue_id: "v1", role: "owner" }),
    tables: {
      venue_invites: () => {
        callCount++
        // First call: lookup, second call: delete
        if (callCount === 1) return { data: invite, error: null }
        return { data: null, error: null }
      },
    },
  })
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

beforeEach(() => vi.clearAllMocks())

describe("DELETE /api/team/invite/[inviteId]", () => {
  it("deletes the invite and returns ok", async () => {
    const client = ownerClientWithInvite()

    const res = await DELETE({} as never, params("inv1"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    const inviteBuilders = client.buildersFor("venue_invites")
    expect(inviteBuilders).toHaveLength(2)
    // Second call is the delete
    expect(inviteBuilders[1].delete).toHaveBeenCalled()
    expect(inviteBuilders[1].eq).toHaveBeenCalledWith("id", "inv1")
    expect(inviteBuilders[1].eq).toHaveBeenCalledWith("venue_id", "v1")
  })

  it("does not write audit_log directly — the audit_venue_invites DB trigger owns that", async () => {
    const client = ownerClientWithInvite()

    await DELETE({} as never, params("inv1"))

    expect(client.from).not.toHaveBeenCalledWith("audit_log")
  })

  it("returns 404 when the invite does not exist", async () => {
    ownerClientWithInvite(null)

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
    mockedCreateClient.mockResolvedValue(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: { venue_invites: { data: null, error: { message: "db error" } } },
      }) as never
    )

    const res = await DELETE({} as never, params("inv1"))
    expect(res.status).toBe(500)
  })
})
