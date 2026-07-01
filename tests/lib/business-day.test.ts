import { describe, it, expect } from "vitest"
import {
  businessDayOf,
  formatLocalDateTime,
  businessDayStartUTC,
  businessDayRangeUTC,
} from "@/lib/business-day"

describe("businessDayOf", () => {
  it("rolls an instant before the 3am cutoff back to the previous calendar day", () => {
    // 1am America/New_York = 5am UTC (EDT, UTC-4)
    expect(businessDayOf(new Date("2026-06-15T05:00:00Z"), "America/New_York")).toBe("2026-06-14")
  })

  it("keeps an instant at/after the 3am cutoff on the same calendar day", () => {
    // 4am America/New_York = 8am UTC
    expect(businessDayOf(new Date("2026-06-15T08:00:00Z"), "America/New_York")).toBe("2026-06-15")
  })
})

describe("formatLocalDateTime", () => {
  it("renders the venue-local wall clock time as 'YYYY-MM-DD HH:mm:ss'", () => {
    // 7:05:09pm America/New_York (EDT, UTC-4)
    expect(formatLocalDateTime(new Date("2026-06-15T23:05:09Z"), "America/New_York")).toBe(
      "2026-06-15 19:05:09"
    )
  })
})

describe("businessDayRangeUTC", () => {
  it("produces bounds whose businessDayOf matches the picked range, one day earlier just outside it", () => {
    const { gte, lt } = businessDayRangeUTC("2026-06-15", "2026-06-15", "America/New_York")

    expect(businessDayOf(new Date(gte), "America/New_York")).toBe("2026-06-15")
    expect(businessDayOf(new Date(new Date(gte).getTime() - 1000), "America/New_York")).toBe(
      "2026-06-14"
    )
    expect(businessDayOf(new Date(new Date(lt).getTime() - 1000), "America/New_York")).toBe(
      "2026-06-15"
    )
    expect(businessDayOf(new Date(lt), "America/New_York")).toBe("2026-06-16")
  })

  it("spans multiple business days inclusive of both endpoints", () => {
    const { gte, lt } = businessDayRangeUTC("2026-06-10", "2026-06-12", "America/New_York")
    expect(gte).toBe(businessDayStartUTC("2026-06-10", "America/New_York").toISOString())
    expect(lt).toBe(businessDayStartUTC("2026-06-13", "America/New_York").toISOString())
  })
})
