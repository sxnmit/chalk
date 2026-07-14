import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test.
// ---------------------------------------------------------------------------

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

vi.mock("@/lib/billing/server", () => ({
  requireRole: vi.fn(),
  apiError: vi.fn((e: unknown) => {
    const hasStatus = typeof (e as { status?: unknown })?.status === "number"
    const status = hasStatus ? (e as { status: number }).status : 500
    const message = hasStatus
      ? (e as { message?: string })?.message ?? "Error"
      : "Internal server error"
    return {
      status,
      json: async () => ({ error: message }),
    }
  }),
  HttpError: class extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
  absoluteUrl: vi.fn((path: string) => `http://localhost:3000${path}`),
}))

vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

// Mock crypto.randomBytes for deterministic token values.
vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: () => "deterministic-token-value",
    })),
  },
}))

// ---------------------------------------------------------------------------
// Imports — after mocks are declared.
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/team/invite/route"
import { requireRole } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedRequireRole = vi.mocked(requireRole)
const mockedCreateAdminClient = vi.mocked(createAdminClient)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRequest = (body: unknown) => ({ json: async () => body }) as never

const INVITE_ROW = {
  id: "inv-1",
  email: "new@example.com",
  role: "staff",
  created_at: "2026-07-14T00:00:00Z",
  expires_at: "2026-07-21T00:00:00Z",
}

/**
 * Build a chainable mock for the admin Supabase client.
 *
 * This route uses `createAdminClient()` (not `createClient`) and also needs
 * `.auth.admin.inviteUserByEmail`, so we build a bespoke mock rather than
 * reusing `createMockClient` from the shared helper.
 */
function buildAdminMock(overrides: {
  insertResult?: { data: unknown; error: unknown }
  inviteResult?: { data: unknown; error: unknown }
  deleteResult?: { data: unknown; error: unknown }
} = {}) {
  const {
    insertResult = { data: INVITE_ROW, error: null },
    inviteResult = { data: { user: {} }, error: null },
    deleteResult = { data: null, error: null },
  } = overrides

  // Track delete calls so we can assert rollback behaviour.
  const deleteMock = vi.fn()

  const fromMock = vi.fn((table: string) => {
    if (table === "venue_invites") {
      return {
        // INSERT chain
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(insertResult)),
          })),
        })),
        // DELETE chain (rollback path)
        delete: vi.fn(() => {
          deleteMock()
          return {
            eq: vi.fn(() => Promise.resolve(deleteResult)),
          }
        }),
      }
    }
    // Fallback for unexpected tables.
    return { insert: vi.fn(), select: vi.fn(), delete: vi.fn() }
  })

  const inviteUserByEmail = vi.fn(() => Promise.resolve(inviteResult))

  return {
    client: {
      from: fromMock,
      auth: { admin: { inviteUserByEmail } },
    },
    fromMock,
    deleteMock,
    inviteUserByEmail,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("INVITE_EMAIL_PROVIDER", "supabase")

  // Default: caller is an owner.
  mockedRequireRole.mockResolvedValue({
    profile: { venueId: "v1", userId: "u1", role: "owner", email: "owner@example.com" },
    supabase: {} as never,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /api/team/invite", () => {
  // 1. Happy path — creates an invite and returns it.
  it("creates an invite and returns it on success", async () => {
    const { client, inviteUserByEmail } = buildAdminMock()
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = await POST(makeRequest({ email: "New@Example.com", role: "staff" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.invite).toEqual(INVITE_ROW)

    // Verify email was sent.
    expect(inviteUserByEmail).toHaveBeenCalledWith("new@example.com", {
      redirectTo: expect.stringContaining("/accept-invite?token="),
    })
  })

  // 2. Missing email — returns 400.
  it("returns 400 for missing email", async () => {
    const { client } = buildAdminMock()
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = await POST(makeRequest({ role: "staff" }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/valid email/i)
  })

  // 3. Invalid email (no @) — returns 400.
  it("returns 400 for invalid email (no @)", async () => {
    const { client } = buildAdminMock()
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = await POST(makeRequest({ email: "not-an-email" }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/valid email/i)
  })

  // 4. Unknown role defaults to "staff".
  it('defaults unknown role to "staff"', async () => {
    const inviteWithRole = { ...INVITE_ROW, role: "staff" }
    const { client, fromMock } = buildAdminMock({
      insertResult: { data: inviteWithRole, error: null },
    })
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = await POST(makeRequest({ email: "new@example.com", role: "superadmin" }))

    expect(res.status).toBe(200)

    // Verify the insert was called with role "staff" (not "superadmin").
    const insertCall = fromMock.mock.results[0].value.insert
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({ role: "staff" })
    )
  })

  // 5. Rolls back invite when email send fails.
  it("rolls back invite when email send fails", async () => {
    const { client, deleteMock, inviteUserByEmail } = buildAdminMock()
    mockedCreateAdminClient.mockReturnValue(client as never)

    // Make email send throw an unrecoverable error.
    inviteUserByEmail.mockRejectedValueOnce(new Error("SMTP down"))

    const res = await POST(makeRequest({ email: "new@example.com", role: "staff" }))

    // The error propagates through apiError, giving a 500.
    expect(res.status).toBe(500)

    // The invite should have been deleted (rollback).
    expect(deleteMock).toHaveBeenCalled()
  })

  // 6. Returns 501 when INVITE_EMAIL_PROVIDER is not set.
  it("returns 501 when INVITE_EMAIL_PROVIDER is not set", async () => {
    vi.stubEnv("INVITE_EMAIL_PROVIDER", "")
    const { client } = buildAdminMock()
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = await POST(makeRequest({ email: "new@example.com", role: "staff" }))

    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/i)
  })

  // 7. Returns 409 when user already has an account.
  it("returns 409 when user already has an account", async () => {
    const { client, inviteUserByEmail } = buildAdminMock()
    mockedCreateAdminClient.mockReturnValue(client as never)

    inviteUserByEmail.mockResolvedValueOnce({
      data: null,
      error: { code: "email_exists", message: "User already registered" },
    })

    const res = await POST(makeRequest({ email: "existing@example.com", role: "staff" }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already has an account/i)
  })

  // 8. Returns error for non-owner callers.
  it("returns error for non-owner callers", async () => {
    const httpError = new Error("Forbidden")
    ;(httpError as unknown as { status: number }).status = 403
    mockedRequireRole.mockRejectedValueOnce(httpError)

    const { client } = buildAdminMock()
    mockedCreateAdminClient.mockReturnValue(client as never)

    const res = await POST(makeRequest({ email: "new@example.com", role: "staff" }))

    expect(res.status).toBe(403)
  })
})
