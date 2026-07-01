import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))

import { closeTabAction } from "@/app/tabs/actions"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)
const ownerSession = makeSession("u1", { venue_id: "v1", role: "owner" })

function withClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("closeTabAction", () => {
  const emptyTab = {
    session: ownerSession,
    tables: {
      sessions: { data: { id: "tab1" }, error: null },
      order_items: { data: null, error: null, count: 0 },
    },
  }

  it("ends the tab when it belongs to the venue and has no items", async () => {
    const client = withClient(createMockClient(emptyTab))
    await expect(closeTabAction("tab1")).resolves.toBeUndefined()

    const update = client.buildersFor("sessions")[1].update as ReturnType<typeof vi.fn>
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ ended_at: expect.any(String) })
    )
  })

  it("rejects a tab that does not belong to the venue", async () => {
    withClient(
      createMockClient({
        session: ownerSession,
        tables: {
          sessions: { data: null, error: { message: "no rows" } },
        },
      })
    )
    await expect(closeTabAction("foreign-tab")).rejects.toThrow("Tab not found for this venue")
  })

  it("refuses to close a tab that already has items on it", async () => {
    withClient(
      createMockClient({
        session: ownerSession,
        tables: {
          sessions: { data: { id: "tab1" }, error: null },
          order_items: { data: null, error: null, count: 2 },
        },
      })
    )
    await expect(closeTabAction("tab1")).rejects.toThrow("Cannot close a tab that has items on it")
  })

  it("throws when unauthenticated", async () => {
    withClient(createMockClient({ session: null }))
    await expect(closeTabAction("tab1")).rejects.toThrow("Not authenticated")
  })
})
