import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
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

import { POST } from "@/app/api/auth/accept-invite/route"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)

function fakeRequest(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

/** The caller accepting the invite — profile resolution has its own tests in billing/server.test.ts. */
function withCaller(userId: string, email: string) {
  mockedCreateClient.mockResolvedValue(
    createMockClient({ session: makeSession(userId, {}, email) }) as never
  )
}

const pendingInvite: {
  id: string
  venue_id: string
  email: string
  role: string
  accepted_at: string | null
  expires_at: string
} = {
  id: "invite-1",
  venue_id: "v1",
  email: "member@example.com",
  role: "manager",
  accepted_at: null,
  expires_at: "2099-01-01T00:00:00Z",
}

/**
 * `invite` is what the first `.from("venue_invites")` lookup (by token)
 * returns; every later call to that table (the accepted_at update) succeeds.
 */
function withAdminClient(options: {
  invite?: typeof pendingInvite | null
  memberError?: unknown
  inviteUpdateError?: unknown
  userError?: unknown
} = {}) {
  const { invite = pendingInvite, memberError = null, inviteUpdateError = null, userError = null } = options

  let venueInvitesCalls = 0
  const client = createMockClient({
    tables: {
      venue_invites: () => {
        venueInvitesCalls += 1
        return venueInvitesCalls === 1
          ? { data: invite, error: null }
          : { data: null, error: inviteUpdateError }
      },
      venue_members: { data: null, error: memberError },
      users: { data: null, error: userError },
    },
  })
  mockedCreateAdminClient.mockReturnValue(client as never)
  return client
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

describe("POST /api/auth/accept-invite", () => {
  it("rejects a missing token with 400", async () => {
    withCaller("u1", "member@example.com")
    const client = withAdminClient()

    const res = (await POST(fakeRequest({}))) as { status: number }

    expect(res.status).toBe(400)
    expect(client.from).not.toHaveBeenCalled()
  })

  it("rejects an unknown token with 400", async () => {
    withCaller("u1", "member@example.com")
    withAdminClient({ invite: null })

    const res = (await POST(fakeRequest({ token: "bogus" }))) as {
      status: number
      json: () => Promise<{ error: string }>
    }

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid or expired/i)
  })

  it("rejects an already-accepted invite with 400", async () => {
    withCaller("u1", "member@example.com")
    withAdminClient({ invite: { ...pendingInvite, accepted_at: "2026-06-01T00:00:00Z" } })

    const res = (await POST(fakeRequest({ token: "tok" }))) as { status: number }
    expect(res.status).toBe(400)
  })

  it("rejects an expired invite with 400", async () => {
    withCaller("u1", "member@example.com")
    withAdminClient({ invite: { ...pendingInvite, expires_at: "2020-01-01T00:00:00Z" } })

    const res = (await POST(fakeRequest({ token: "tok" }))) as { status: number }
    expect(res.status).toBe(400)
  })

  it("rejects a mismatched email with 403", async () => {
    withCaller("u1", "someone-else@example.com")
    withAdminClient()

    const res = (await POST(fakeRequest({ token: "tok" }))) as {
      status: number
      json: () => Promise<{ error: string }>
    }

    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/different email/i)
  })

  it("accepts a valid invite: joins the venue with the invited role and marks it accepted", async () => {
    withCaller("u1", "member@example.com")
    const client = withAdminClient()

    const res = (await POST(fakeRequest({ token: "tok" }))) as {
      status: number
      json: () => Promise<{ ok: boolean; venueId: string }>
    }

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, venueId: "v1" })

    expect(client.buildersFor("venue_members")[0].upsert).toHaveBeenCalledWith({
      venue_id: "v1",
      user_id: "u1",
      role: "manager",
    })

    const [, inviteUpdateBuilder] = client.buildersFor("venue_invites")
    expect(inviteUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ accepted_at: expect.any(String) })
    )
    expect(inviteUpdateBuilder.eq).toHaveBeenCalledWith("id", "invite-1")

    expect(client.buildersFor("users")[0].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1", venue_id: "v1", role: "manager" })
    )
  })

  it("matches invite email to caller email case-insensitively", async () => {
    withCaller("u1", "Member@Example.com")
    withAdminClient()

    const res = (await POST(fakeRequest({ token: "tok" }))) as { status: number }
    expect(res.status).toBe(200)
  })

  it("surfaces a generic 500 instead of a raw DB error when the membership upsert fails", async () => {
    withCaller("u1", "member@example.com")
    withAdminClient({ memberError: new Error("constraint violation") })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = (await POST(fakeRequest({ token: "tok" }))) as {
      status: number
      json: () => Promise<{ error: string }>
    }

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("Internal server error")
    spy.mockRestore()
  })
})
