import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient } from "@/test/supabase-mock"

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getProfile: vi.fn() }))

import { getSessionDetail, getMenuItems } from "@/app/session/[id]/actions"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const mockedCreateClient = vi.mocked(createClient)
const mockedGetProfile = vi.mocked(getProfile)

function withClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetProfile.mockResolvedValue({
    venueId: "v1",
    role: "owner",
    userId: "u1",
  } as never)
})

describe("getSessionDetail", () => {
  it("returns formatted session with correct field mapping", async () => {
    withClient(
      createMockClient({
        tables: {
          sessions: {
            data: {
              id: "s1",
              started_at: "2026-06-28T12:00:00Z",
              ended_at: null,
              actual_rate_charged: 25,
              player_name: "Alice",
              table_id: "t1",
              tables: { name: "Table 1" },
              rates: { label: "Standard" },
              venues: { name: "My Venue" },
            },
            error: null,
          },
        },
      })
    )

    const result = await getSessionDetail("s1")

    expect(result).toEqual({
      id: "s1",
      tableName: "Table 1",
      tableId: "t1",
      startedAt: "2026-06-28T12:00:00Z",
      endedAt: null,
      actualRateCharged: 25,
      rateName: "Standard",
      playerName: "Alice",
      venueName: "My Venue",
      isTab: false,
    })
  })

  it("handles a tab (null table_id, null rate_id) with isTab true", async () => {
    withClient(
      createMockClient({
        tables: {
          sessions: {
            data: {
              id: "tab1",
              started_at: "2026-06-28T14:00:00Z",
              ended_at: null,
              actual_rate_charged: 0,
              player_name: "Bob",
              table_id: null,
              tables: null,
              rates: null,
              venues: { name: "My Venue" },
            },
            error: null,
          },
        },
      })
    )

    const result = await getSessionDetail("tab1")

    expect(result).not.toBeNull()
    expect(result!.isTab).toBe(true)
    expect(result!.tableName).toBeNull()
    expect(result!.tableId).toBeNull()
    expect(result!.rateName).toBeNull()
  })

  it("handles null actual_rate_charged by falling back to 0", async () => {
    withClient(
      createMockClient({
        tables: {
          sessions: {
            data: {
              id: "s2",
              started_at: "2026-06-28T12:00:00Z",
              ended_at: null,
              actual_rate_charged: null,
              player_name: null,
              table_id: "t1",
              tables: { name: "Table 1" },
              rates: { label: "League" },
              venues: { name: "My Venue" },
            },
            error: null,
          },
        },
      })
    )

    const result = await getSessionDetail("s2")

    expect(result).not.toBeNull()
    expect(result!.actualRateCharged).toBe(0)
  })

  it("handles missing venue name by falling back to 'Venue'", async () => {
    withClient(
      createMockClient({
        tables: {
          sessions: {
            data: {
              id: "s3",
              started_at: "2026-06-28T12:00:00Z",
              ended_at: null,
              actual_rate_charged: 15,
              player_name: null,
              table_id: "t1",
              tables: { name: "Table 1" },
              rates: { label: "League" },
              venues: null,
            },
            error: null,
          },
        },
      })
    )

    const result = await getSessionDetail("s3")

    expect(result).not.toBeNull()
    expect(result!.venueName).toBe("Venue")
  })

  it("returns null when session is not found", async () => {
    withClient(
      createMockClient({
        tables: {
          sessions: {
            data: null,
            error: { message: "no rows" },
          },
        },
      })
    )

    const result = await getSessionDetail("nonexistent")

    expect(result).toBeNull()
  })
})

describe("getMenuItems", () => {
  it("returns available menu items", async () => {
    const items = [
      {
        id: "m1",
        venue_id: "v1",
        name: "Beer",
        category: "Drinks",
        price_cents: 700,
        available: true,
        stock_quantity: null,
        sort_order: 0,
        created_at: "2026-06-28T12:00:00Z",
      },
      {
        id: "m2",
        venue_id: "v1",
        name: "Nachos",
        category: "Food",
        price_cents: 1200,
        available: true,
        stock_quantity: 10,
        sort_order: 0,
        created_at: "2026-06-28T12:00:00Z",
      },
    ]

    withClient(
      createMockClient({
        tables: {
          menu_items: { data: items, error: null },
        },
      })
    )

    const result = await getMenuItems()

    expect(result).toEqual(items)
    expect(result).toHaveLength(2)
  })

  it("returns empty array when no items exist", async () => {
    withClient(
      createMockClient({
        tables: {
          menu_items: { data: null, error: null },
        },
      })
    )

    const result = await getMenuItems()

    expect(result).toEqual([])
  })
})
