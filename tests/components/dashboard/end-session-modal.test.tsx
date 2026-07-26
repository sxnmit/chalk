import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { EndSessionModal } from "@/components/dashboard/end-session-modal"
import type { PoolTable, Rate, PeakSchedule } from "@/lib/pool-types"

const NOW = new Date("2026-06-28T18:00:00Z")
const ONE_HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000)

const noPeakSchedule: PeakSchedule = { days: [], startHour: 0, endHour: 0 }

// The rate has since been edited to $25/hr; the session locked in $15/hr at start.
const rates: Rate[] = [
  { id: "r1", name: "League", pricePerHour: 25, isDefault: true, isPeakRate: false, isActive: true },
]

const table: PoolTable = {
  id: "t1",
  name: "Table 1",
  tableNumber: 1,
  session: {
    id: "s1",
    tableId: "t1",
    rateId: "r1",
    actualRateCharged: 15,
    itemsTotalCents: 0,
    startTime: ONE_HOUR_AGO,
  },
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe("EndSessionModal", () => {
  it("bills the summary against the rate snapshotted at session start, not the rate's current price", () => {
    render(
      <EndSessionModal
        table={table}
        rates={rates}
        peakSchedule={noPeakSchedule}
        currency="USD"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // 1 hour at the $15/hr snapshot = $15.00, not $25.00 at the rate's current price.
    expect(screen.getByText("$15.00")).toBeInTheDocument()
    expect(screen.getByText(/League \(\$15\.00\/hr\)/)).toBeInTheDocument()
  })
})
