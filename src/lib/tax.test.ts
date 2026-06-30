import { describe, it, expect, vi } from "vitest"
import { createMockClient, makeSession } from "@/test/supabase-mock"
import { getVenueTaxRate, computeTaxCents } from "./tax"

describe("computeTaxCents", () => {
  it("computes tax as a rounded percentage of the subtotal", () => {
    expect(computeTaxCents(10000, 0.13)).toBe(1300)
  })

  it("rounds to the nearest cent", () => {
    expect(computeTaxCents(999, 0.13)).toBe(130) // 999 * 0.13 = 129.87 → 130
  })

  it("returns 0 when the rate is 0", () => {
    expect(computeTaxCents(5000, 0)).toBe(0)
  })

  it("returns 0 when the subtotal is 0", () => {
    expect(computeTaxCents(0, 0.13)).toBe(0)
  })
})

describe("getVenueTaxRate", () => {
  it("returns the tax rate as a decimal", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: { venues: { data: { tax_rate: 13 }, error: null } },
    })

    const rate = await getVenueTaxRate(client as never, "v1")
    expect(rate).toBe(0.13)
  })

  it("returns 0 when venue has no tax rate set", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: { venues: { data: { tax_rate: 0 }, error: null } },
    })

    const rate = await getVenueTaxRate(client as never, "v1")
    expect(rate).toBe(0)
  })

  it("returns 0 when venue lookup fails", async () => {
    const client = createMockClient({
      session: makeSession("u1", { venue_id: "v1", role: "owner" }),
      tables: { venues: { data: null, error: { message: "not found" } } },
    })

    const rate = await getVenueTaxRate(client as never, "v1")
    expect(rate).toBe(0)
  })
})
