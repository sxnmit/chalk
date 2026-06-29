import { describe, it, expect } from "vitest"
import { tableTotalCents, isPeakHourInTz } from "./billing-table"

const ms = (iso: string) => new Date(iso).getTime()
const hours = (n: number) => n * 60 * 60 * 1000

describe("isPeakHourInTz", () => {
  // 2026-06-26 is a Friday; America/New_York is UTC-4 (EDT) in June.
  it("is peak Friday 8pm local", () => {
    expect(isPeakHourInTz(ms("2026-06-27T00:30:00Z"), "America/New_York")).toBe(true) // Fri 8:30pm ET
  })
  it("is not peak Friday 7:30pm local", () => {
    expect(isPeakHourInTz(ms("2026-06-26T23:30:00Z"), "America/New_York")).toBe(false) // Fri 7:30pm ET
  })
  it("is peak Saturday 2am local (Friday night)", () => {
    expect(isPeakHourInTz(ms("2026-06-27T06:00:00Z"), "America/New_York")).toBe(true) // Sat 2am ET
  })
  it("is not peak Sunday 4am local", () => {
    expect(isPeakHourInTz(ms("2026-06-28T08:00:00Z"), "America/New_York")).toBe(false) // Sun 4am ET
  })
  it("resolves the window in the venue timezone, not UTC", () => {
    // Same instant: Fri 11:30pm UTC is only 7:30pm in New York (off-peak).
    const instant = ms("2026-06-26T23:30:00Z")
    expect(isPeakHourInTz(instant, "UTC")).toBe(true) // Fri 23:30 UTC → peak
    expect(isPeakHourInTz(instant, "America/New_York")).toBe(false)
  })
})

describe("tableTotalCents", () => {
  it("returns 0 for non-positive duration", () => {
    expect(tableTotalCents(ms("2026-06-22T12:00:00Z"), ms("2026-06-22T12:00:00Z"), 25, 25, "UTC")).toBe(0)
  })

  it("bills flat when the rate is at/above peak", () => {
    const start = ms("2026-06-22T12:00:00Z") // Monday, off-peak
    expect(tableTotalCents(start, start + hours(2), 25, 25, "UTC")).toBe(5000)
  })

  it("bills fractional hours flat", () => {
    const start = ms("2026-06-22T12:00:00Z")
    expect(tableTotalCents(start, start + hours(1.5), 20, 20, "UTC")).toBe(3000)
  })

  it("bills a league rate at the league price when fully off-peak", () => {
    const start = ms("2026-06-22T12:00:00Z") // Monday noon
    expect(tableTotalCents(start, start + hours(2), 15, 25, "UTC")).toBe(3000)
  })

  it("charges the peak rate for hours that begin in the peak window", () => {
    // Fri 7:30pm ET, 2 hours: hour 1 starts off-peak ($15), hour 2 starts at
    // 8:30pm in the peak window ($25) → $40.00.
    const start = ms("2026-06-26T23:30:00Z")
    expect(tableTotalCents(start, start + hours(2), 15, 25, "America/New_York")).toBe(4000)
  })
})
