import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

// next/server's NextResponse isn't available in jsdom — stub the bits we use.
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import {
  getRequestProfile,
  requireProfile,
  requireRole,
  apiError,
  absoluteUrl,
  loadSubscriptionSummary,
  HttpError,
} from "./server"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getRequestProfile", () => {
  it("returns null when unauthenticated", async () => {
    const client = createMockClient({ session: null })
    await expect(getRequestProfile(client as never)).resolves.toBeNull()
  })

  it("reads venue and role from JWT claims", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }, "a@b.com"),
    })
    await expect(getRequestProfile(client as never)).resolves.toEqual({
      userId: "u1",
      email: "a@b.com",
      venueId: "v1",
      role: "owner",
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("prefers active_venue_id over venue_id", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", active_venue_id: "v2", role: "manager" }),
    })
    await expect(getRequestProfile(client as never)).resolves.toMatchObject({ venueId: "v2" })
  })

  it("falls back to membership when claims lack a valid role", async () => {
    const client = createMockClient({
      session: makeSession("u2", { venue_id: "v1", role: "intruder" }),
      tables: { venue_members: { data: { venue_id: "v9", role: "staff" }, error: null } },
    })
    await expect(getRequestProfile(client as never)).resolves.toMatchObject({
      venueId: "v9",
      role: "staff",
    })
    expect(client.from).toHaveBeenCalledWith("venue_members")
  })

  it("falls back to the legacy users table when no membership exists", async () => {
    const client = createMockClient({
      session: makeSession("u3", {}),
      tables: {
        venue_members: { data: null, error: null },
        users: { data: { venue_id: "v-legacy", role: "owner" }, error: null },
      },
    })
    await expect(getRequestProfile(client as never)).resolves.toMatchObject({
      venueId: "v-legacy",
      role: "owner",
    })
  })

  it("returns null when no venue can be resolved", async () => {
    const client = createMockClient({
      session: makeSession("u4", {}),
      tables: {
        venue_members: { data: null, error: null },
        users: { data: null, error: null },
      },
    })
    await expect(getRequestProfile(client as never)).resolves.toBeNull()
  })

  it("returns a venue-less staff profile when allowMissingVenue is set", async () => {
    const client = createMockClient({
      session: makeSession("u5", {}),
      tables: {
        venue_members: { data: null, error: null },
        users: { data: null, error: null },
      },
    })
    await expect(
      getRequestProfile(client as never, { allowMissingVenue: true })
    ).resolves.toMatchObject({ userId: "u5", venueId: "", role: "staff" })
  })
})

describe("requireProfile", () => {
  it("throws 401 when unauthenticated", async () => {
    mockedCreateClient.mockResolvedValue(createMockClient({ session: null }) as never)
    await expect(requireProfile()).rejects.toMatchObject({ status: 401 })
  })

  it("throws 403 when authenticated but has no active venue", async () => {
    const client = createMockClient({
      session: makeSession("u6", {}),
      tables: {
        venue_members: { data: null, error: null },
        users: { data: null, error: null },
      },
    })
    mockedCreateClient.mockResolvedValue(client as never)
    await expect(requireProfile({ allowMissingVenue: true })).resolves.toMatchObject({
      profile: { venueId: "" },
    })
    await expect(requireProfile()).rejects.toMatchObject({ status: 401 })
  })

  it("returns supabase + profile on success", async () => {
    const client = createMockClient({
      session: makeSession("u7", { venue_id: "v1", role: "owner" }),
    })
    mockedCreateClient.mockResolvedValue(client as never)
    const ctx = await requireProfile()
    expect(ctx.profile.venueId).toBe("v1")
    expect(ctx.supabase).toBe(client)
  })
})

describe("requireRole", () => {
  it("passes when the role is allowed", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({ session: makeSession("u8", { venue_id: "v1", role: "owner" }) }) as never
    )
    await expect(requireRole(["owner"])).resolves.toMatchObject({ profile: { role: "owner" } })
  })

  it("throws 403 when the role is not allowed", async () => {
    mockedCreateClient.mockResolvedValue(
      createMockClient({ session: makeSession("u9", { venue_id: "v1", role: "staff" }) }) as never
    )
    await expect(requireRole(["owner", "manager"])).rejects.toMatchObject({ status: 403 })
  })
})

describe("apiError", () => {
  it("maps an HttpError to its status and message", () => {
    const res = apiError(new HttpError(404, "Nope")) as unknown as { body: { error: string }; status: number }
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Nope" })
  })

  it("maps an unknown error to a 500", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = apiError(new Error("boom")) as unknown as { body: { error: string }; status: number }
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: "Internal server error" })
    spy.mockRestore()
  })
})

describe("absoluteUrl", () => {
  const original = { ...process.env }
  afterEach(() => {
    process.env = { ...original }
  })

  it("uses NEXT_PUBLIC_APP_URL when present", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.chalk.com"
    expect(absoluteUrl("/billing")).toBe("https://app.chalk.com/billing")
  })

  it("prefixes a bare VERCEL host with https", () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "chalk.vercel.app"
    expect(absoluteUrl("/x")).toBe("https://chalk.vercel.app/x")
  })

  it("falls back to localhost", () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    expect(absoluteUrl("/y")).toBe("http://localhost:3000/y")
  })
})

describe("loadSubscriptionSummary", () => {
  it("maps an existing subscription row", async () => {
    mockedCreateAdminClient.mockReturnValue(
      createMockClient({
        tables: {
          subscriptions: {
            data: {
              venue_id: "v1",
              status: "active",
              stripe_customer_id: "cus_1",
              stripe_subscription_id: "sub_1",
              stripe_price_id: "price_1",
              trial_ends_at: null,
              current_period_end: "2026-07-01",
              cancel_at_period_end: false,
            },
            error: null,
          },
        },
      }) as never
    )

    await expect(loadSubscriptionSummary("v1")).resolves.toMatchObject({
      venueId: "v1",
      status: "active",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: "2026-07-01",
    })
  })

  it("returns a 'none' summary from the venue when no subscription exists", async () => {
    mockedCreateAdminClient.mockReturnValue(
      createMockClient({
        tables: {
          subscriptions: { data: null, error: null },
          venues: { data: { stripe_customer_id: "cus_legacy" }, error: null },
        },
      }) as never
    )

    await expect(loadSubscriptionSummary("v2")).resolves.toEqual({
      venueId: "v2",
      status: "none",
      stripeCustomerId: "cus_legacy",
      stripeSubscriptionId: null,
      stripePriceId: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    })
  })

  it("throws when the subscriptions query errors", async () => {
    mockedCreateAdminClient.mockReturnValue(
      createMockClient({
        tables: { subscriptions: { data: null, error: new Error("db down") } },
      }) as never
    )
    await expect(loadSubscriptionSummary("v3")).rejects.toThrow("db down")
  })
})
