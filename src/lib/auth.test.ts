import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

// Mock the SSR Supabase factory before importing the module under test.
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))

import { getProfile } from "./auth"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)

function useClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValue(client as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getProfile", () => {
  it("reads venue and role straight from JWT claims (no DB query)", async () => {
    const client = createMockClient({
      session: makeSession("user-1", { venue_id: "venue-1", role: "owner" }),
    })
    useClient(client)

    await expect(getProfile()).resolves.toEqual({
      venueId: "venue-1",
      role: "owner",
      userId: "user-1",
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("defaults role to staff when the claim omits it", async () => {
    const client = createMockClient({
      session: makeSession("user-1", { venue_id: "venue-1" }),
    })
    useClient(client)

    await expect(getProfile()).resolves.toMatchObject({ role: "staff" })
  })

  it("throws when there is no session", async () => {
    useClient(createMockClient({ session: null }))
    await expect(getProfile()).rejects.toThrow("Not authenticated")
  })

  it("falls back to venue_members when the claim has no venue", async () => {
    const client = createMockClient({
      session: makeSession("user-2", {}),
      tables: {
        venue_members: { data: { venue_id: "venue-9", role: "manager" }, error: null },
      },
    })
    useClient(client)

    await expect(getProfile()).resolves.toEqual({
      venueId: "venue-9",
      role: "manager",
      userId: "user-2",
    })
    expect(client.from).toHaveBeenCalledWith("venue_members")
  })

  it("falls back to the legacy users table when no membership exists", async () => {
    const client = createMockClient({
      session: makeSession("user-3", {}),
      tables: {
        venue_members: { data: null, error: null },
        users: { data: { venue_id: "venue-legacy", role: "owner" }, error: null },
      },
    })
    useClient(client)

    await expect(getProfile()).resolves.toEqual({
      venueId: "venue-legacy",
      role: "owner",
      userId: "user-3",
    })
    expect(client.from).toHaveBeenCalledWith("users")
  })

  it("throws when the user belongs to no venue", async () => {
    const client = createMockClient({
      session: makeSession("user-4", {}),
      tables: {
        venue_members: { data: null, error: null },
        users: { data: null, error: null },
      },
    })
    useClient(client)

    await expect(getProfile()).rejects.toThrow("no venue")
  })
})
