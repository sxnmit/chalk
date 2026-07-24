import { describe, it, expect } from "vitest"
import { computeNextRun, formatCadence } from "@/lib/shipment-schedule"

// Anchors below deliberately avoid Sun/Fri boundaries around DST so we assert
// pure cadence math, not tz-specific edge cases. A dedicated DST test covers
// that separately.

describe("computeNextRun — weekly", () => {
  it("finds the next selected weekday at runHour local", () => {
    // 2026-07-06 is a Monday. Ask for next Wed (3) at 6am ET, from Mon 3am ET.
    const from = new Date("2026-07-06T07:00:00Z") // Mon 3am ET
    const next = computeNextRun(
      { cadenceType: "weekly", weeklyDays: [3], intervalDays: null, runHour: 6, timezone: "America/New_York" },
      from,
    )
    // Wed 6am ET = Wed 10:00 UTC (EDT)
    expect(next.toISOString()).toBe("2026-07-08T10:00:00.000Z")
  })

  it("skips today if runHour already passed", () => {
    // Mon 8am ET, ask for weekly [Mon] at 6am.
    const from = new Date("2026-07-06T12:00:00Z") // Mon 8am ET
    const next = computeNextRun(
      { cadenceType: "weekly", weeklyDays: [1], intervalDays: null, runHour: 6, timezone: "America/New_York" },
      from,
    )
    // Next Mon 6am ET = 2026-07-13T10:00:00Z
    expect(next.toISOString()).toBe("2026-07-13T10:00:00.000Z")
  })

  it("picks the earliest of multiple days", () => {
    // Sat 12pm UTC, ask for [Mon(1), Thu(4)]. Mon comes first.
    const from = new Date("2026-07-04T12:00:00Z") // Sat
    const next = computeNextRun(
      { cadenceType: "weekly", weeklyDays: [1, 4], intervalDays: null, runHour: 6, timezone: "UTC" },
      from,
    )
    expect(next.toISOString()).toBe("2026-07-06T06:00:00.000Z") // Mon
  })

  it("chooses today when runHour is still ahead", () => {
    // Mon 2am ET, ask [Mon] at 6am.
    const from = new Date("2026-07-06T06:00:00Z") // Mon 2am ET
    const next = computeNextRun(
      { cadenceType: "weekly", weeklyDays: [1], intervalDays: null, runHour: 6, timezone: "America/New_York" },
      from,
    )
    expect(next.toISOString()).toBe("2026-07-06T10:00:00.000Z") // Mon 6am ET
  })
})

describe("computeNextRun — interval", () => {
  it("adds intervalDays to lastRunAt, snapped to runHour local", () => {
    const lastRun = new Date("2026-07-01T10:00:00Z") // Wed 6am ET
    const from = new Date("2026-07-02T00:00:00Z")
    const next = computeNextRun(
      { cadenceType: "interval", weeklyDays: null, intervalDays: 7, runHour: 6, timezone: "America/New_York" },
      from,
      lastRun,
    )
    // +7d = Wed 2026-07-08 6am ET = 10:00 UTC
    expect(next.toISOString()).toBe("2026-07-08T10:00:00.000Z")
  })

  it("uses `from` when lastRunAt is null (new shipment fires N days out)", () => {
    const from = new Date("2026-07-01T10:00:00Z") // Wed 6am ET
    const next = computeNextRun(
      { cadenceType: "interval", weeklyDays: null, intervalDays: 3, runHour: 6, timezone: "America/New_York" },
      from,
      null,
    )
    // +3d = Sat 6am ET
    expect(next.toISOString()).toBe("2026-07-04T10:00:00.000Z")
  })

  it("advances past `from` when a run was missed (outage recovery)", () => {
    // last run was 20 days ago, interval=7, and we're catching up now.
    const lastRun = new Date("2026-06-15T10:00:00Z")
    const from = new Date("2026-07-06T10:00:00Z")
    const next = computeNextRun(
      { cadenceType: "interval", weeklyDays: null, intervalDays: 7, runHour: 6, timezone: "America/New_York" },
      from,
      lastRun,
    )
    // Should skip past 2026-06-22, 2026-06-29, 2026-07-06 (each <= from) and
    // land on 2026-07-13 6am ET.
    expect(next.getTime()).toBeGreaterThan(from.getTime())
    expect(next.toISOString()).toBe("2026-07-13T10:00:00.000Z")
  })
})

describe("computeNextRun — DST", () => {
  it("keeps the local hour stable across the spring forward", () => {
    // US spring forward 2026: 2026-03-08 at 2am → 3am local.
    // From Fri 2026-03-06 12:00 UTC (7am ET, EST, UTC-5). Ask for weekly [Mon] at 6am.
    // Target Mon 2026-03-09 is *after* DST, so 6am local = 10:00 UTC (EDT, UTC-4).
    const from = new Date("2026-03-06T12:00:00Z")
    const next = computeNextRun(
      { cadenceType: "weekly", weeklyDays: [1], intervalDays: null, runHour: 6, timezone: "America/New_York" },
      from,
    )
    expect(next.toISOString()).toBe("2026-03-09T10:00:00.000Z")
  })
})

describe("formatCadence", () => {
  it("formats weekly with day list", () => {
    expect(
      formatCadence({
        cadenceType: "weekly", weeklyDays: [1, 4], intervalDays: null,
        runHour: 6, timezone: "UTC",
      }),
    ).toBe("Every Mon, Thu at 6:00 AM")
  })

  it("formats every-day weekly succinctly", () => {
    expect(
      formatCadence({
        cadenceType: "weekly", weeklyDays: [0, 1, 2, 3, 4, 5, 6],
        intervalDays: null, runHour: 15, timezone: "UTC",
      }),
    ).toBe("Every day at 3:00 PM")
  })

  it("formats interval", () => {
    expect(
      formatCadence({
        cadenceType: "interval", weeklyDays: null, intervalDays: 7,
        runHour: 0, timezone: "UTC",
      }),
    ).toBe("Every 7 days at 12:00 AM")
  })

  it("formats interval of 1 as daily", () => {
    expect(
      formatCadence({
        cadenceType: "interval", weeklyDays: null, intervalDays: 1,
        runHour: 12, timezone: "UTC",
      }),
    ).toBe("Every day at 12:00 PM")
  })
})
