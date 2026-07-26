import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { exportSessionsCsvAction, exportAuditLogCsvAction } from "@/app/revenue/actions"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)

function withClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

type AuthUser = { email?: string; user_metadata?: { name?: string } }

/** Configure createAdminClient().auth.admin.getUserById(id) for a fixed set of ids. */
function withAuthUsers(usersById: Record<string, AuthUser | null>) {
  mockedCreateAdminClient.mockReturnValue({
    auth: {
      admin: {
        getUserById: vi.fn((id: string) =>
          Promise.resolve({ data: { user: usersById[id] ? { id, ...usersById[id] } : null }, error: null })
        ),
      },
    },
  } as never)
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

describe("exportAuditLogCsvAction", () => {
  it("rejects managers — audit log export is owner-only, unlike the sessions export", async () => {
    withClient(
      createMockClient({ session: makeSession("u1", { venue_id: "v1", role: "manager" }) })
    )
    await expect(exportAuditLogCsvAction("2026-06-15", "2026-06-15")).rejects.toThrow(
      "Not authorized"
    )
  })

  it("rejects a range longer than 1 year", async () => {
    withClient(
      createMockClient({ session: makeSession("u1", { venue_id: "v1", role: "owner" }) })
    )
    await expect(exportAuditLogCsvAction("2025-01-01", "2026-06-15")).rejects.toThrow(
      "Date range cannot exceed 1 year"
    )
  })

  it("resolves actor names through legacy users, then auth metadata name, then email, then the raw id", async () => {
    withAuthUsers({
      "u-modern": { user_metadata: { name: "Priya" } },
      "u-email-only": { email: "sam@example.com" },
      // u-deleted intentionally absent -> getUserById resolves { user: null }.
    })
    const client = withClient(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: {
          venues: venueRow,
          users: { data: [{ id: "u-legacy", name: "Vish" }], error: null },
          audit_log: {
            data: [
              {
                created_at: "2026-06-15T17:00:00Z",
                actor_id: "u-legacy",
                actor_role: "owner",
                entity_type: "rates",
                entity_id: "r1",
                operation: "update",
                before: { hourly_rate: 15, label: "League" },
                after: { hourly_rate: 20, label: "League" },
              },
              {
                created_at: "2026-06-15T18:00:00Z",
                actor_id: "u-modern",
                actor_role: "staff",
                entity_type: "sessions",
                entity_id: "s1",
                operation: "insert",
                before: null,
                after: { started_at: "2026-06-15T18:00:00Z" },
              },
              {
                created_at: "2026-06-15T19:00:00Z",
                actor_id: "u-email-only",
                actor_role: "manager",
                entity_type: "tables",
                entity_id: "t1",
                operation: "update",
                before: { status: "free" },
                after: { status: "occupied" },
              },
              {
                created_at: "2026-06-15T20:00:00Z",
                actor_id: "u-deleted",
                actor_role: "staff",
                entity_type: "sessions",
                entity_id: "s2",
                operation: "delete",
                before: { started_at: "2026-06-15T20:00:00Z" },
                after: null,
              },
              {
                created_at: "2026-06-15T21:00:00Z",
                actor_id: null,
                actor_role: null,
                entity_type: "payments",
                entity_id: "p1",
                operation: "update",
                before: { status: "pending" },
                after: { status: "succeeded" },
              },
            ],
            error: null,
          },
        },
      })
    )

    const result = await exportAuditLogCsvAction("2026-06-15", "2026-06-15")
    expect(result.filename).toBe("chalk-audit-log-shy-lounge-2026-06-15-to-2026-06-15.csv")

    const lines = result.csv.split("\r\n")
    expect(lines[0]).toBe("Timestamp,Actor,Role,Entity,Entity ID,Operation,Source,Summary of Change")
    // Legacy `users.name` takes precedence.
    expect(lines[1]).toBe(
      "2026-06-15 17:00:00,Vish,owner,rates,r1,update,,hourly_rate: 15 → 20"
    )
    // No `users` row -> auth user_metadata.name.
    expect(lines[2]).toBe("2026-06-15 18:00:00,Priya,staff,sessions,s1,insert,,Created")
    // No metadata name -> auth email.
    expect(lines[3]).toBe("2026-06-15 19:00:00,sam@example.com,manager,tables,t1,update,,status: free → occupied")
    // No users row and no matching auth user -> raw actor id.
    expect(lines[4]).toBe("2026-06-15 20:00:00,u-deleted,staff,sessions,s2,delete,,Deleted")
    // Null actor_id (service-role/webhook mutation) -> "System".
    expect(lines[5]).toBe(
      "2026-06-15 21:00:00,System,,payments,p1,update,,status: pending → succeeded"
    )
    expect(lines).toHaveLength(6)

    const auditLogBuilder = client.buildersFor("audit_log")[0]
    expect(auditLogBuilder.eq).toHaveBeenCalledWith("venue_id", "v1")
    expect(auditLogBuilder.gte).toHaveBeenCalledWith("created_at", "2026-06-15T03:00:00.000Z")
    expect(auditLogBuilder.lt).toHaveBeenCalledWith("created_at", "2026-06-16T03:00:00.000Z")
  })

  it("returns a header-only CSV with a note when there are no audit events", async () => {
    withClient(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: { venues: venueRow, audit_log: { data: [], error: null } },
      })
    )

    const result = await exportAuditLogCsvAction("2026-06-15", "2026-06-15")
    const lines = result.csv.split("\r\n")
    expect(lines[1]).toBe("No audit events in this range,,,,,,,")
    expect(lines).toHaveLength(2)
  })

  it("labels shipment_cron / shipment_manual rows with the shipment name via the Source column", async () => {
    withAuthUsers({ "u-owner": { user_metadata: { name: "Vish" } } })
    const client = withClient(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: {
          venues: venueRow,
          users: { data: [], error: null },
          audit_log: {
            data: [
              // Cron-driven stock bump: no actor, source=shipment_cron.
              {
                created_at: "2026-06-15T10:00:00Z",
                actor_id: null,
                actor_role: null,
                entity_type: "menu_items",
                entity_id: "m1",
                operation: "update",
                before: { stock_quantity: 4 },
                after: { stock_quantity: 28 },
                context: { source: "shipment_cron", shipment_id: "ship-beer" },
              },
              // Manual "Run now": actor present, source=shipment_manual.
              {
                created_at: "2026-06-15T11:00:00Z",
                actor_id: "u-owner",
                actor_role: "owner",
                entity_type: "menu_items",
                entity_id: "m2",
                operation: "update",
                before: { stock_quantity: 0 },
                after: { stock_quantity: 12 },
                context: { source: "shipment_manual", shipment_id: "ship-snacks", triggered_by: "u-owner" },
              },
              // Shipment schedule edit — CRUD on stock_shipments itself has no context.
              {
                created_at: "2026-06-15T12:00:00Z",
                actor_id: "u-owner",
                actor_role: "owner",
                entity_type: "stock_shipments",
                entity_id: "ship-beer",
                operation: "update",
                before: { active: true },
                after: { active: false },
                context: null,
              },
              // Cron row for a shipment that has since been deleted — no lookup match.
              {
                created_at: "2026-06-15T13:00:00Z",
                actor_id: null,
                actor_role: null,
                entity_type: "menu_items",
                entity_id: "m3",
                operation: "update",
                before: { stock_quantity: 2 },
                after: { stock_quantity: 26 },
                context: { source: "shipment_cron", shipment_id: "ship-deleted" },
              },
              // Unknown context.source — must not leak raw JSON into the CSV.
              {
                created_at: "2026-06-15T14:00:00Z",
                actor_id: "u-owner",
                actor_role: "owner",
                entity_type: "rates",
                entity_id: "r1",
                operation: "update",
                before: { hourly_rate: 15 },
                after: { hourly_rate: 20 },
                context: { source: "future_webhook", note: "n/a" },
              },
            ],
            error: null,
          },
          stock_shipments: {
            data: [
              { id: "ship-beer", name: "Beer delivery" },
              { id: "ship-snacks", name: "Snacks" },
            ],
            error: null,
          },
        },
      })
    )

    const result = await exportAuditLogCsvAction("2026-06-15", "2026-06-15")
    const lines = result.csv.split("\r\n")

    expect(lines[0]).toBe("Timestamp,Actor,Role,Entity,Entity ID,Operation,Source,Summary of Change")
    expect(lines[1]).toBe(
      "2026-06-15 10:00:00,System,,menu_items,m1,update,Shipment (scheduled): Beer delivery,stock_quantity: 4 → 28"
    )
    expect(lines[2]).toBe(
      "2026-06-15 11:00:00,Vish,owner,menu_items,m2,update,Shipment (manual): Snacks,stock_quantity: 0 → 12"
    )
    // Direct edit to a shipment row itself — context is null, Source blank.
    expect(lines[3]).toBe(
      "2026-06-15 12:00:00,Vish,owner,stock_shipments,ship-beer,update,,active: true → false"
    )
    // Deleted shipment falls back to a friendly "(deleted)" rather than a bare UUID.
    expect(lines[4]).toBe(
      "2026-06-15 13:00:00,System,,menu_items,m3,update,Shipment (scheduled): (deleted),stock_quantity: 2 → 26"
    )
    // Unknown source key — collapses to blank Source rather than exposing raw JSON.
    expect(lines[5]).toBe(
      "2026-06-15 14:00:00,Vish,owner,rates,r1,update,,hourly_rate: 15 → 20"
    )
    expect(lines).toHaveLength(6)

    // The shipment-name lookup MUST be venue-scoped so a colliding UUID in
    // another tenant's audit_log can never appear here.
    const shipmentsBuilder = client.buildersFor("stock_shipments")[0]
    expect(shipmentsBuilder.eq).toHaveBeenCalledWith("venue_id", "v1")
    expect(shipmentsBuilder.in).toHaveBeenCalledWith("id", expect.arrayContaining(["ship-beer", "ship-snacks", "ship-deleted"]))
  })

  it("skips the shipment-name lookup entirely when no rows reference a shipment", async () => {
    const client = withClient(
      createMockClient({
        session: makeSession("u1", { venue_id: "v1", role: "owner" }),
        tables: {
          venues: venueRow,
          users: { data: [], error: null },
          audit_log: {
            data: [
              {
                created_at: "2026-06-15T09:00:00Z",
                actor_id: null,
                actor_role: null,
                entity_type: "payments",
                entity_id: "p1",
                operation: "update",
                before: { status: "pending" },
                after: { status: "succeeded" },
                context: null,
              },
            ],
            error: null,
          },
        },
      })
    )

    await exportAuditLogCsvAction("2026-06-15", "2026-06-15")

    // No shipment-context rows -> we should not have queried stock_shipments at all.
    expect(client.buildersFor("stock_shipments")).toHaveLength(0)
  })
})
