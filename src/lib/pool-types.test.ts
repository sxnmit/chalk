import { describe, it, expect, afterEach, vi } from "vitest"
import {
  isPeakHour,
  calculateAmountOwed,
  formatDuration,
  formatTime,
  formatCurrency,
  type Rate,
} from "./pool-types"

// Tests run with TZ pinned to America/New_York (see vitest.config.ts).
// June 2026 calendar anchors used below:
//   Fri 2026-06-26, Sat 2026-06-27, Sun 2026-06-28, Mon 2026-06-29.
const at = (month: number, day: number, hour: number, minute = 0) =>
  new Date(2026, month, day, hour, minute, 0)

const league: Rate = {
  id: "r-league",
  name: "League",
  pricePerHour: 15,
  isDefault: false,
  isPeakRate: false,
  isActive: true,
}
const flat: Rate = {
  id: "r-flat",
  name: "Non-League",
  pricePerHour: 25,
  isDefault: true,
  isPeakRate: false,
  isActive: true,
}
const PEAK = 25

describe("isPeakHour", () => {
  it("is peak from Friday 8pm onward", () => {
    expect(isPeakHour(at(5, 26, 19, 59))).toBe(false)
    expect(isPeakHour(at(5, 26, 20, 0))).toBe(true)
    expect(isPeakHour(at(5, 26, 23, 30))).toBe(true)
  })

  it("stays peak into Saturday until 3am (Friday night)", () => {
    expect(isPeakHour(at(5, 27, 0, 0))).toBe(true)
    expect(isPeakHour(at(5, 27, 2, 59))).toBe(true)
    expect(isPeakHour(at(5, 27, 3, 0))).toBe(false)
  })

  it("is not peak during the Saturday daytime lull", () => {
    expect(isPeakHour(at(5, 27, 12, 0))).toBe(false)
    expect(isPeakHour(at(5, 27, 19, 59))).toBe(false)
  })

  it("is peak from Saturday 8pm into Sunday 3am", () => {
    expect(isPeakHour(at(5, 27, 20, 0))).toBe(true)
    expect(isPeakHour(at(5, 28, 0, 0))).toBe(true)
    expect(isPeakHour(at(5, 28, 2, 59))).toBe(true)
    expect(isPeakHour(at(5, 28, 3, 0))).toBe(false)
  })

  it("is never peak on weekdays", () => {
    expect(isPeakHour(at(5, 29, 21, 0))).toBe(false) // Mon night
    expect(isPeakHour(at(5, 25, 21, 0))).toBe(false) // Thu night
  })
})

describe("calculateAmountOwed", () => {
  afterEach(() => vi.useRealTimers())

  it("returns 0 when no rate is supplied", () => {
    expect(calculateAmountOwed(at(5, 29, 12, 0), undefined, PEAK, at(5, 29, 14, 0))).toBe(0)
  })

  describe("flat billing (rate >= peak)", () => {
    it("charges whole hours continuously", () => {
      expect(calculateAmountOwed(at(5, 29, 12, 0), flat, PEAK, at(5, 29, 14, 0))).toBe(50)
    })

    it("charges fractional hours continuously", () => {
      expect(calculateAmountOwed(at(5, 29, 12, 0), flat, PEAK, at(5, 29, 13, 30))).toBe(37.5)
    })

    it("ignores peak transitions entirely", () => {
      // Crosses Fri 8pm but flat rate is unaffected: 2h * $25.
      expect(calculateAmountOwed(at(5, 26, 19, 0), flat, PEAK, at(5, 26, 21, 0))).toBe(50)
    })
  })

  describe("league billing (rate < peak)", () => {
    it("charges the league rate while fully off-peak", () => {
      expect(calculateAmountOwed(at(5, 29, 12, 0), league, PEAK, at(5, 29, 14, 0))).toBe(30)
    })

    it("switches to peak at the billing-hour boundary that starts in peak", () => {
      // 19:00 hour starts off-peak ($15); 20:00 hour starts in peak ($25).
      expect(calculateAmountOwed(at(5, 26, 19, 0), league, PEAK, at(5, 26, 21, 0))).toBe(40)
    })

    it("bills each whole hour by the rate at its start", () => {
      // 19:00→22:00 = off-peak + peak + peak = 15 + 25 + 25.
      expect(calculateAmountOwed(at(5, 26, 19, 0), league, PEAK, at(5, 26, 22, 0))).toBe(65)
    })

    it("prorates a partial final hour", () => {
      expect(calculateAmountOwed(at(5, 29, 12, 0), league, PEAK, at(5, 29, 12, 30))).toBe(7.5)
    })

    it("keeps an off-peak hour off-peak even when it crosses 8pm", () => {
      // Hour starts 19:30 off-peak, so the whole hour bills at $15 despite
      // crossing 8pm; next hour (20:30) starts in peak at $25.
      expect(calculateAmountOwed(at(5, 26, 19, 30), league, PEAK, at(5, 26, 21, 30))).toBe(40)
    })
  })

  it("uses the current time for an open (active) session", () => {
    vi.useFakeTimers()
    vi.setSystemTime(at(5, 29, 14, 0))
    // Started 2h ago, no endTime → flat rate × 2h.
    expect(calculateAmountOwed(at(5, 29, 12, 0), flat, PEAK)).toBe(50)
  })
})

describe("formatDuration", () => {
  it("formats a zero duration", () => {
    const t = at(5, 29, 12, 0)
    expect(formatDuration(t, t)).toBe("00:00:00")
  })

  it("zero-pads hours, minutes, and seconds", () => {
    const start = new Date(0)
    expect(formatDuration(start, new Date(3661 * 1000))).toBe("01:01:01")
  })

  it("does not roll hours over at 24", () => {
    const start = new Date(0)
    expect(formatDuration(start, new Date(25 * 3600 * 1000))).toBe("25:00:00")
  })
})

describe("formatTime", () => {
  it("renders 12-hour local time", () => {
    expect(formatTime(at(5, 26, 14, 5))).toBe("2:05 PM")
    expect(formatTime(at(5, 26, 0, 0))).toBe("12:00 AM")
  })
})

describe("formatCurrency", () => {
  it("formats USD with two decimals and thousands separators", () => {
    expect(formatCurrency(25)).toBe("$25.00")
    expect(formatCurrency(1234.5)).toBe("$1,234.50")
    expect(formatCurrency(0)).toBe("$0.00")
  })
})
