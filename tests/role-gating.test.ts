import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient } from "@/test/supabase-mock"

// next/server's NextResponse isn't available in happy-dom. We stub a class that
// supports both `new NextResponse(body, init)` and the static `.json(...)`
// factory the routes use.
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

import { POST as menuPost } from "@/app/api/menu/route"
import { PATCH as menuPatch, DELETE as menuDelete } from "@/app/api/menu/[id]/route"
import { POST as adminTablesPost, GET as adminTablesGet } from "@/app/api/admin/tables/route"
import { POST as adminRatesPost, GET as adminRatesGet } from "@/app/api/admin/rates/route"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const mockedCreateClient = vi.mocked(createClient)
const mockedGetProfile = vi.mocked(getProfile)

type Role = "owner" | "manager" | "staff"

function asProfile(role: Role) {
  return { venueId: "v1", role, userId: "u1" } as Awaited<ReturnType<typeof getProfile>>
}

function withRole(role: Role) {
  mockedGetProfile.mockResolvedValue(asProfile(role))
  mockedCreateClient.mockResolvedValue(createMockClient({}) as never)
}

const fakeRequest = (body: unknown) =>
  ({ json: async () => body } as unknown as Parameters<typeof menuPost>[0])

const fakeParams = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Menu mutations — `/api/menu` (POST) and `/api/menu/[id]` (PATCH, DELETE)
//
// Read access (GET) is intentionally open to staff so they can take orders;
// these tests only cover mutation routes.
// ---------------------------------------------------------------------------

describe("POST /api/menu", () => {
  const validBody = { name: "Wings", category: "Food", price_cents: 1200, available: true, stock_quantity: null }

  it.each(["owner", "manager"] as const)("allows %s", async (role) => {
    withRole(role)
    const res = (await menuPost(fakeRequest(validBody))) as { status: number }
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(401)
  })

  it("rejects staff with 403", async () => {
    withRole("staff")
    const res = (await menuPost(fakeRequest(validBody))) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Forbidden")
  })
})

describe("PATCH /api/menu/[id]", () => {
  it.each(["owner", "manager"] as const)("allows %s", async (role) => {
    withRole(role)
    const res = (await menuPatch(fakeRequest({ name: "Renamed" }), fakeParams("m1"))) as { status: number }
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(401)
  })

  it("rejects staff with 403", async () => {
    withRole("staff")
    const res = (await menuPatch(fakeRequest({ name: "Renamed" }), fakeParams("m1"))) as unknown as {
      status: number
      body: { error: string }
    }
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Forbidden")
  })
})

describe("DELETE /api/menu/[id]", () => {
  it.each(["owner", "manager"] as const)("allows %s", async (role) => {
    withRole(role)
    const res = (await menuDelete({} as never, fakeParams("m1"))) as { status: number }
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(401)
  })

  it("rejects staff with 403", async () => {
    withRole("staff")
    const res = (await menuDelete({} as never, fakeParams("m1"))) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Forbidden")
  })
})

// ---------------------------------------------------------------------------
// Admin tables — `/api/admin/tables`. ADMIN_ROLES guards every verb.
// ---------------------------------------------------------------------------

describe("/api/admin/tables", () => {
  it.each(["owner", "manager"] as const)("GET allows %s", async (role) => {
    withRole(role)
    const res = (await adminTablesGet()) as { status: number }
    expect(res.status).not.toBe(403)
  })

  it("GET rejects staff with 403", async () => {
    withRole("staff")
    const res = (await adminTablesGet()) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Forbidden")
  })

  it("POST rejects staff with 403", async () => {
    withRole("staff")
    const res = (await adminTablesPost(
      fakeRequest({ name: "Table 1", size: "9ft", admin_status: "active" })
    )) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Forbidden")
  })
})

// ---------------------------------------------------------------------------
// Admin rates — `/api/admin/rates`. ADMIN_ROLES guards every verb.
// ---------------------------------------------------------------------------

describe("/api/admin/rates", () => {
  it.each(["owner", "manager"] as const)("GET allows %s", async (role) => {
    withRole(role)
    const res = (await adminRatesGet()) as { status: number }
    expect(res.status).not.toBe(403)
  })

  it("GET rejects staff with 403", async () => {
    withRole("staff")
    const res = (await adminRatesGet()) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Forbidden")
  })

  it("POST rejects staff with 403", async () => {
    withRole("staff")
    const res = (await adminRatesPost(
      fakeRequest({ label: "League", hourly_rate: 15, active: true, is_default: false })
    )) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("Forbidden")
  })
})
