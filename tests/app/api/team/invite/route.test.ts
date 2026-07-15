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

import { POST } from "@/app/api/team/invite/route"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)

const originalProvider = process.env.INVITE_EMAIL_PROVIDER

function fakeRequest(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

/** Sets up the caller's profile (via requireRole -> createClient). */
function withCaller(role: "owner" | "manager" | "staff") {
  mockedCreateClient.mockResolvedValue(
    createMockClient({ session: makeSession("owner-1", { venue_id: "v1", role }) }) as never
  )
}

const invitedRow = {
  id: "invite-1",
  email: "new@example.com",
  role: "staff",
  created_at: "2026-07-01T00:00:00Z",
  expires_at: "2026-07-08T00:00:00Z",
}

/**
 * Builds the admin client used for `venue_invites` DB ops and (when the email
 * provider is configured) the Supabase auth invite call. `existingInvite` is
 * what the first `.from("venue_invites")` lookup (the dedupe check) returns;
 * every later call to that table returns `invitedRow`.
 */
function withAdminClient(options: {
  existingInvite?: { id: string; token: string } | null
  inviteUserByEmail?: ReturnType<typeof vi.fn>
} = {}) {
  const { existingInvite = null, inviteUserByEmail = vi.fn(async () => ({ error: null })) } = options

  let venueInvitesCalls = 0
  const client = createMockClient({
    tables: {
      venue_invites: () => {
        venueInvitesCalls += 1
        return venueInvitesCalls === 1
          ? { data: existingInvite, error: null }
          : { data: invitedRow, error: null }
      },
    },
  }) as ReturnType<typeof createMockClient> & { auth: { admin: { inviteUserByEmail: typeof inviteUserByEmail } } }

  client.auth.admin = { inviteUserByEmail }
  mockedCreateAdminClient.mockReturnValue(client as never)
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.INVITE_EMAIL_PROVIDER = "supabase"
})
afterEach(() => {
  process.env.INVITE_EMAIL_PROVIDER = originalProvider
})

describe("POST /api/team/invite", () => {
  it("rejects non-owners with 403", async () => {
    withCaller("manager")
    withAdminClient()

    const res = (await POST(fakeRequest({ email: "new@example.com", role: "staff" }))) as {
      status: number
      json: () => Promise<{ error: string }>
    }

    expect(res.status).toBe(403)
  })

  it("rejects an invalid email with 400 and does not touch the database", async () => {
    withCaller("owner")
    const client = withAdminClient()

    const res = (await POST(fakeRequest({ email: "not-an-email", role: "staff" }))) as {
      status: number
    }

    expect(res.status).toBe(400)
    expect(client.from).not.toHaveBeenCalled()
  })

  it("rejects an invalid role with 400 instead of silently defaulting to staff", async () => {
    withCaller("owner")
    withAdminClient()

    const res = (await POST(fakeRequest({ email: "new@example.com", role: "superadmin" }))) as {
      status: number
    }

    expect(res.status).toBe(400)
  })

  it("defaults role to staff when omitted", async () => {
    withCaller("owner")
    const client = withAdminClient({ existingInvite: null })

    const res = (await POST(fakeRequest({ email: "new@example.com" }))) as { status: number }

    expect(res.status).toBe(200)
    const insertBuilder = client.buildersFor("venue_invites")[1]
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "staff" })
    )
  })

  it("creates a new invite and emails it when none is pending", async () => {
    withCaller("owner")
    const client = withAdminClient({ existingInvite: null })

    const res = (await POST(fakeRequest({ email: "New@Example.com", role: "manager" }))) as {
      status: number
      json: () => Promise<{ invite: typeof invitedRow }>
    }

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.invite).toEqual(invitedRow)

    const [checkBuilder, insertBuilder] = client.buildersFor("venue_invites")
    expect(checkBuilder.eq).toHaveBeenCalledWith("email", "new@example.com")
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ venue_id: "v1", email: "new@example.com", role: "manager" })
    )
    expect(client.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "new@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/accept-invite?token=") })
    )
  })

  it("updates the existing pending invite instead of inserting a duplicate, without rotating its token", async () => {
    withCaller("owner")
    const client = withAdminClient({
      existingInvite: { id: "invite-existing", token: "original-token" },
    })

    const res = (await POST(fakeRequest({ email: "new@example.com", role: "manager" }))) as {
      status: number
    }

    expect(res.status).toBe(200)
    const [, updateBuilder] = client.buildersFor("venue_invites")
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ role: "manager" })
    )
    expect(updateBuilder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ token: expect.anything() })
    )
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "invite-existing")

    // The email resend must reuse the invite's original token, since a
    // failed send should never orphan a link already sitting in someone's inbox.
    expect(client.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "new@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining(encodeURIComponent("original-token")),
      })
    )
  })

  it("returns 501 and rolls back a freshly created invite when no email provider is configured", async () => {
    delete process.env.INVITE_EMAIL_PROVIDER
    withCaller("owner")
    const client = withAdminClient({ existingInvite: null })

    const res = (await POST(fakeRequest({ email: "new@example.com", role: "staff" }))) as {
      status: number
    }

    expect(res.status).toBe(501)
    const [, insertBuilder, deleteBuilder] = client.buildersFor("venue_invites")
    expect(insertBuilder.insert).toHaveBeenCalled()
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith("id", invitedRow.id)
  })

  it("does not roll back an existing pending invite when resending fails", async () => {
    delete process.env.INVITE_EMAIL_PROVIDER
    withCaller("owner")
    const client = withAdminClient({
      existingInvite: { id: "invite-existing", token: "original-token" },
    })

    const res = (await POST(fakeRequest({ email: "new@example.com", role: "staff" }))) as {
      status: number
    }

    expect(res.status).toBe(501)
    const builders = client.buildersFor("venue_invites")
    expect(builders).toHaveLength(2)
    expect(builders[1].delete).not.toHaveBeenCalled()
  })

  it("maps an already-registered email to a 409", async () => {
    withCaller("owner")
    const inviteUserByEmail = vi.fn(async () => ({ error: { code: "email_exists" } }))
    const client = withAdminClient({ existingInvite: null, inviteUserByEmail })

    const res = (await POST(fakeRequest({ email: "new@example.com", role: "staff" }))) as {
      status: number
      json: () => Promise<{ error: string }>
    }

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already has an account/i)
    const [, insertBuilder, deleteBuilder] = client.buildersFor("venue_invites")
    expect(insertBuilder.insert).toHaveBeenCalled()
    expect(deleteBuilder.delete).toHaveBeenCalled()
  })
})
