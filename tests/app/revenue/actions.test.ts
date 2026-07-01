import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))

import { exportSessionsCsvAction } from "@/app/revenue/actions"
import { createClient } from "@/utils/supabase/server"

const mockedCreateClient = vi.mocked(createClient)

function withClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

const venueRow = { data: { name: "Shy Lounge", timezone: "UTC" }, error: null }

beforeEach(() => vi.clearAllMocks())

describe("exportSessionsCsvAction", () => {
  it("rejects staff (owner/manager only)", async () => {
    withClient(
      createMockClient({ session: makeSession("u1", { venue_id: "v1", role: "staff" }) })
    )
    await expect(exportSessionsCsvAction("2026-06-15", "2026-06-15")).rejects.toThrow(
      "Not authorized"
    )
  })

  it("rejects a range where 'from' is after 'to'", async () => {
    withClient(
      createMockClient({ session: makeSession("u1", { venue_id: "v1", role: "owner" }) })
    )
    await expect(exportSessionsCsvAction("2026-06-20", "2026-06-15")).rejects.toThrow(
      "Start date must be on or before end date"
    )
  })

  it("rejects a range longer than 1 year", async () => {
    withClient(
      createMockClient({ session: makeSession("u1", { venue_id: "v1", role: "owner" }) })
    )
    await expect(exportSessionsCsvAction("2025-01-01", "2026-06-15")).rejects.toThrow(
      "Date range cannot exceed 1 year"
    )
  })

  it("groups pool table and bar tab sessions into separate sections with subtotals", async () => {
    const client = withClient(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: {
          venues: venueRow,
          payments: {
            data: [
              {
                grand_total_cents: 2430,
                table_total_cents: 2250,
                items_total_cents: 0,
                tax_cents: 180,
                tip_cents: 0,
                method: "cash",
                sessions: {
                  started_at: "2026-06-15T14:00:00Z",
                  ended_at: "2026-06-15T15:30:00Z",
                  player_name: "Bob",
                  table_id: "t1",
                  rates: { label: "League" },
                  tables: { name: "Table 1" },
                },
              },
              {
                grand_total_cents: 2200,
                table_total_cents: 0,
                items_total_cents: 2000,
                tax_cents: 100,
                tip_cents: 100,
                method: "card",
                sessions: {
                  started_at: "2026-06-15T20:00:00Z",
                  ended_at: "2026-06-15T21:00:00Z",
                  player_name: "Sara, Q",
                  table_id: null,
                  rates: null,
                  tables: null,
                },
              },
            ],
            error: null,
          },
        },
      })
    )

    const result = await exportSessionsCsvAction("2026-06-15", "2026-06-15")

    expect(result.filename).toBe("chalk-sessions-shy-lounge-2026-06-15-to-2026-06-15.csv")

    const lines = result.csv.split("\r\n")
    expect(lines[0]).toBe(
      "Date,Table,Player,Rate,Start,End,Duration (hrs),Table ($),Items ($),Tax ($),Tip ($),Total ($),Payment Method"
    )
    expect(lines[1].split(",")).toEqual(["Pool Tables", ...Array(12).fill("")])
    expect(lines[2]).toBe(
      "2026-06-15,Table 1,Bob,League,2026-06-15 14:00:00,2026-06-15 15:30:00,1.50,22.50,0.00,1.80,0.00,24.30,cash"
    )
    expect(lines[3].split(",")).toEqual(["Subtotal", ...Array(10).fill(""), "24.30", ""])
    expect(lines[4].split(",")).toEqual(["Bar Tabs", ...Array(12).fill("")])
    // Player name contains a comma, so it must come back quoted.
    expect(lines[5]).toBe(
      '2026-06-15,,"Sara, Q",,2026-06-15 20:00:00,2026-06-15 21:00:00,1.00,0.00,20.00,1.00,1.00,22.00,card'
    )
    expect(lines[6].split(",")).toEqual(["Subtotal", ...Array(10).fill(""), "22.00", ""])
    expect(lines).toHaveLength(7)

    // Range filter uses the venue-local business day, not raw calendar dates.
    const paymentsBuilder = client.buildersFor("payments")[0]
    expect(paymentsBuilder.gte).toHaveBeenCalledWith("sessions.started_at", "2026-06-15T03:00:00.000Z")
    expect(paymentsBuilder.lt).toHaveBeenCalledWith("sessions.started_at", "2026-06-16T03:00:00.000Z")
  })

  it("returns a header-only CSV with 'no sessions' notes for both sections when the range is empty", async () => {
    withClient(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "manager" }),
        tables: { venues: venueRow, payments: { data: [], error: null } },
      })
    )

    const result = await exportSessionsCsvAction("2026-06-15", "2026-06-15")
    const lines = result.csv.split("\r\n")

    expect(lines[1].split(",")).toEqual(["Pool Tables", ...Array(12).fill("")])
    expect(lines[2].split(",")).toEqual(["No sessions in this range", ...Array(12).fill("")])
    expect(lines[3].split(",")).toEqual(["Bar Tabs", ...Array(12).fill("")])
    expect(lines[4].split(",")).toEqual(["No sessions in this range", ...Array(12).fill("")])
    expect(lines).toHaveLength(5)
  })
})
