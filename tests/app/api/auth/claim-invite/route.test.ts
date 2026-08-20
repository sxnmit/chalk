import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient } from "@/test/supabase-mock"

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { GET, POST } from "@/app/api/auth/claim-invite/route"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedCreateAdminClient = vi.mocked(createAdminClient)

function postRequest(body: unknown) {
  return { json: async () => body, url: "http://localhost/api/auth/claim-invite" } as unknown as Parameters<typeof POST>[0]
}
function getRequest(token?: string) {
  const url = token
    ? `http://localhost/api/auth/claim-invite?token=${encodeURIComponent(token)}`
    : "http://localhost/api/auth/claim-invite"
  return { url } as unknown as Parameters<typeof GET>[0]
}

const pendingInvite = {
  id: "invite-1",
  venue_id: "v1",
  email: "member@example.com",
  role: "manager",
  accepted_at: null as string | null,
  expires_at: "2099-01-01T00:00:00Z",
  invited_user_id: "shell-user-1" as string | null,
}

function withAdminClient(options: {
  invite?: typeof pendingInvite | null
  updateUserById?: ReturnType<typeof vi.fn>
  createUser?: ReturnType<typeof vi.fn>
} = {}) {
  const {
    invite = pendingInvite,
    updateUserById = vi.fn(async () => ({ data: { user: { id: "shell-user-1" } }, error: null })),
    createUser = vi.fn(async () => ({ data: { user: { id: "created-user-1" } }, error: null })),
  } = options

  let venueInvitesCalls = 0
  const client = createMockClient({
    tables: {
      venue_invites: () => {
        venueInvitesCalls += 1
        return venueInvitesCalls === 1
          ? { data: invite, error: null }
          : { data: null, error: null }
      },
      venue_members: { data: null, error: null },
      users: { data: null, error: null },
    },
  }) as ReturnType<typeof createMockClient> & {
    auth: { admin: { updateUserById: typeof updateUserById; createUser: typeof createUser } }
  }

  client.auth.admin = { updateUserById, createUser }
  mockedCreateAdminClient.mockReturnValue(client as never)
  return client
}

const validBody = {
  token: "tok",
  name: "Sanmit",
  email: "member@example.com",
  password: "supersecret",
}

beforeEach(() => vi.clearAllMocks())

describe("POST /api/auth/claim-invite", () => {
  it("rejects a body missing the password with 400", async () => {
    withAdminClient()
    const res = (await POST(postRequest({ token: "tok", name: "Sanmit", email: "member@example.com" }))) as {
      status: number
    }
    expect(res.status).toBe(400)
  })

  it("rejects a too-short password with 400", async () => {
    withAdminClient()
    const res = (await POST(postRequest({ ...validBody, password: "short" }))) as { status: number }
    expect(res.status).toBe(400)
  })

  it("rejects an unknown token with 400", async () => {
    withAdminClient({ invite: null })
    const res = (await POST(postRequest(validBody))) as {
      status: number
      json: () => Promise<{ error: string }>
    }
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid or expired/i)
  })

  it("rejects an expired invite with 400", async () => {
    withAdminClient({ invite: { ...pendingInvite, expires_at: "2020-01-01T00:00:00Z" } })
    const res = (await POST(postRequest(validBody))) as { status: number }
    expect(res.status).toBe(400)
  })

  it("rejects an already-accepted invite with 400", async () => {
    withAdminClient({ invite: { ...pendingInvite, accepted_at: "2026-06-01T00:00:00Z" } })
    const res = (await POST(postRequest(validBody))) as { status: number }
    expect(res.status).toBe(400)
  })

  it("rejects an email that doesn't match the invite with 403", async () => {
    withAdminClient()
    const res = (await POST(postRequest({ ...validBody, email: "someone-else@example.com" }))) as {
      status: number
      json: () => Promise<{ error: string }>
    }
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/different email/i)
  })

  it("attaches the password to the pre-created shell and joins the venue", async () => {
    const client = withAdminClient()
    const res = (await POST(postRequest(validBody))) as {
      status: number
      json: () => Promise<{ ok: boolean; email: string }>
    }

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, email: "member@example.com" })

    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith(
      "shell-user-1",
      expect.objectContaining({ password: "supersecret", user_metadata: { name: "Sanmit" } })
    )
    expect(client.auth.admin.createUser).not.toHaveBeenCalled()

    expect(client.buildersFor("venue_members")[0].upsert).toHaveBeenCalledWith({
      venue_id: "v1",
      user_id: "shell-user-1",
      role: "manager",
    })
    const [, inviteUpdateBuilder] = client.buildersFor("venue_invites")
    expect(inviteUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ accepted_at: expect.any(String) })
    )
    expect(client.buildersFor("users")[0].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "shell-user-1", venue_id: "v1", role: "manager" })
    )
  })

  it("creates the user when no shell exists and joins with the new id", async () => {
    const client = withAdminClient({ invite: { ...pendingInvite, invited_user_id: null } })
    const res = (await POST(postRequest(validBody))) as { status: number }

    expect(res.status).toBe(200)
    expect(client.auth.admin.updateUserById).not.toHaveBeenCalled()
    expect(client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "member@example.com", password: "supersecret" })
    )
    expect(client.buildersFor("venue_members")[0].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "created-user-1" })
    )
  })

  it("falls back to creating the user if the shell went missing", async () => {
    const updateUserById = vi.fn(async () => ({ data: { user: null }, error: { code: "user_not_found" } }))
    const client = withAdminClient({ updateUserById })
    const res = (await POST(postRequest(validBody))) as { status: number }

    expect(res.status).toBe(200)
    expect(client.auth.admin.createUser).toHaveBeenCalled()
  })

  it("surfaces a generic 500 instead of a raw error when the member upsert fails", async () => {
    const client = withAdminClient()
    // Make the venue_members upsert reject.
    client.from = vi.fn((table: string) => {
      if (table === "venue_members") {
        return { upsert: () => Promise.reject(new Error("boom")) } as never
      }
      return createMockClient({
        tables: { venue_invites: { data: pendingInvite, error: null }, users: { data: null, error: null } },
      }).from(table)
    }) as never
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = (await POST(postRequest(validBody))) as {
      status: number
      json: () => Promise<{ error: string }>
    }
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("Internal server error")
    spy.mockRestore()
  })
})

describe("GET /api/auth/claim-invite", () => {
  it("returns 400 when the token is missing", async () => {
    withAdminClient()
    const res = (await GET(getRequest())) as { status: number }
    expect(res.status).toBe(400)
  })

  it("returns the invited email for a valid token", async () => {
    withAdminClient()
    const res = (await GET(getRequest("tok"))) as {
      status: number
      json: () => Promise<{ email: string }>
    }
    expect(res.status).toBe(200)
    expect((await res.json()).email).toBe("member@example.com")
  })

  it("returns 400 for an unknown token", async () => {
    withAdminClient({ invite: null })
    const res = (await GET(getRequest("bogus"))) as { status: number }
    expect(res.status).toBe(400)
  })
})
