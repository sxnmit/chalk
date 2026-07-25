import { describe, it, expect, vi } from "vitest"
import {
  collectShipmentIds,
  formatAuditDiff,
  formatAuditSource,
  withAuditContext,
} from "@/lib/audit"

describe("formatAuditDiff", () => {
  it("reports an insert as Created", () => {
    expect(formatAuditDiff(null, { hourly_rate: 15 })).toBe("Created")
  })

  it("reports a delete as Deleted", () => {
    expect(formatAuditDiff({ hourly_rate: 15 }, null)).toBe("Deleted")
  })

  it("diffs changed fields only, in a stable field order", () => {
    expect(
      formatAuditDiff(
        { hourly_rate: 15, is_default: false, label: "League" },
        { hourly_rate: 20, is_default: true, label: "League" }
      )
    ).toBe("hourly_rate: 15 → 20; is_default: false → true")
  })

  it("skips id/venue_id/created_at even when they differ", () => {
    expect(
      formatAuditDiff(
        { id: "a", venue_id: "v1", created_at: "t1", label: "League" },
        { id: "a", venue_id: "v1", created_at: "t2", label: "Peak" }
      )
    ).toBe("label: League → Peak")
  })

  it("reports no-op updates explicitly", () => {
    expect(formatAuditDiff({ label: "League" }, { label: "League" })).toBe("No field changes")
  })

  it("renders null/undefined fields distinctly from the string 'null'", () => {
    expect(formatAuditDiff({ notes: null }, { notes: "back early" })).toBe("notes: ∅ → back early")
  })
})

describe("withAuditContext", () => {
  it("sets the context via RPC before running the mutation", async () => {
    const calls: string[] = []
    const rpc = vi.fn(() => {
      calls.push("rpc")
      return Promise.resolve({ error: null })
    })
    const supabase = { rpc } as never

    const result = await withAuditContext(supabase, { reason: "customer dispute" }, async () => {
      calls.push("fn")
      return "done"
    })

    expect(rpc).toHaveBeenCalledWith("set_audit_context", { ctx: { reason: "customer dispute" } })
    expect(calls).toEqual(["rpc", "fn"])
    expect(result).toBe("done")
  })

  it("throws if set_audit_context fails, without running the mutation", async () => {
    const rpc = vi.fn(() => Promise.resolve({ error: new Error("permission denied") }))
    const supabase = { rpc } as never
    const fn = vi.fn(async () => "done")

    await expect(withAuditContext(supabase, {}, fn)).rejects.toThrow("permission denied")
    expect(fn).not.toHaveBeenCalled()
  })
})

describe("formatAuditSource", () => {
  const names = new Map([
    ["ship-1", "Beer delivery"],
    ["ship-2", "Snacks"],
  ])

  it("returns empty for null/undefined context", () => {
    expect(formatAuditSource(null, names)).toBe("")
    expect(formatAuditSource(undefined, names)).toBe("")
  })

  it("returns empty when context.source is not a known shipment source", () => {
    expect(formatAuditSource({ source: "future_webhook" }, names)).toBe("")
    expect(formatAuditSource({ note: "nope" }, names)).toBe("")
    expect(formatAuditSource({}, names)).toBe("")
  })

  it("labels shipment_cron rows as (scheduled) with the shipment name", () => {
    expect(
      formatAuditSource({ source: "shipment_cron", shipment_id: "ship-1" }, names)
    ).toBe("Shipment (scheduled): Beer delivery")
  })

  it("labels shipment_manual rows as (manual) with the shipment name", () => {
    expect(
      formatAuditSource({ source: "shipment_manual", shipment_id: "ship-2" }, names)
    ).toBe("Shipment (manual): Snacks")
  })

  it("falls back to (deleted) when the shipment id isn't in the lookup", () => {
    expect(
      formatAuditSource({ source: "shipment_cron", shipment_id: "ship-gone" }, names)
    ).toBe("Shipment (scheduled): (deleted)")
  })

  it("falls back to (unknown) when shipment_id is missing", () => {
    expect(
      formatAuditSource({ source: "shipment_cron" }, names)
    ).toBe("Shipment (scheduled): (unknown)")
  })
})

describe("collectShipmentIds", () => {
  it("returns [] for an empty input", () => {
    expect(collectShipmentIds([])).toEqual([])
  })

  it("skips null/undefined and non-shipment contexts", () => {
    expect(
      collectShipmentIds([
        null,
        undefined,
        { source: "webhook" },
        { source: "shipment_cron", shipment_id: "ship-1" },
      ])
    ).toEqual(["ship-1"])
  })

  it("dedupes shipment_ids across mixed cron/manual contexts", () => {
    const ids = collectShipmentIds([
      { source: "shipment_cron", shipment_id: "ship-a" },
      { source: "shipment_manual", shipment_id: "ship-b", triggered_by: "u1" },
      { source: "shipment_cron", shipment_id: "ship-a" },
      { source: "shipment_cron" }, // no shipment_id -> ignored
    ])
    expect(ids.sort()).toEqual(["ship-a", "ship-b"])
  })
})
