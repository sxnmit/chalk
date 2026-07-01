import { describe, it, expect } from "vitest"
import { hasRole, BLOCKED_SUBSCRIPTION_STATUSES } from "@/lib/billing/types"

describe("hasRole", () => {
  it("returns true when the role is in the allow-list", () => {
    expect(hasRole("owner", ["owner", "manager"])).toBe(true)
    expect(hasRole("staff", ["staff"])).toBe(true)
  })

  it("returns false when the role is not allowed", () => {
    expect(hasRole("staff", ["owner", "manager"])).toBe(false)
  })

  it("returns false for an empty allow-list", () => {
    expect(hasRole("owner", [])).toBe(false)
  })
})

describe("BLOCKED_SUBSCRIPTION_STATUSES", () => {
  it("blocks unpaid, canceled, and incomplete states", () => {
    for (const status of ["unpaid", "canceled", "incomplete", "incomplete_expired", "paused"]) {
      expect(BLOCKED_SUBSCRIPTION_STATUSES.has(status)).toBe(true)
    }
  })

  it("does not block healthy states", () => {
    for (const status of ["active", "past_due"]) {
      expect(BLOCKED_SUBSCRIPTION_STATUSES.has(status)).toBe(false)
    }
  })
})
