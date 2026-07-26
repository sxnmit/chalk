import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TableCard } from "@/components/dashboard/table-card"
import type { PoolTable, Rate, PeakSchedule, TableSession } from "@/lib/pool-types"

const NOW = new Date("2026-06-28T18:00:00Z")
const ONE_HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000)

// No peak days at all, so calculateAmountOwed's whole-hour-boundary billing
// always uses the plain hourly rate — keeps these totals arithmetic-simple.
const noPeakSchedule: PeakSchedule = { days: [], startHour: 0, endHour: 0 }

// The rate has since been edited to $25/hr; the session locked in $15/hr at start.
const rates: Rate[] = [
  { id: "r1", name: "League", pricePerHour: 25, isDefault: true, isPeakRate: false, isActive: true },
]

function makeTable(sessionOverrides: Partial<TableSession> = {}): PoolTable {
  return {
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
      ...sessionOverrides,
    },
  }
}

function renderCard(sessionOverrides: Partial<TableSession> = {}) {
  return render(
    <TableCard
      table={makeTable(sessionOverrides)}
      rates={rates}
      peakSchedule={noPeakSchedule}
      currency="USD"
      onStartSession={vi.fn()}
      onEndSession={vi.fn()}
    />
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe("TableCard", () => {
  it("bills the live Amount Owed against the rate snapshotted at session start, not the rate's current price", () => {
    renderCard()

    // 1 hour at the $15/hr snapshot = $15.00, not $25.00 at the rate's current price.
    expect(screen.getByText("$15.00")).toBeInTheDocument()
  })

  it("adds ordered food & drinks onto the table-time Amount Owed", () => {
    renderCard({ itemsTotalCents: 1234 })

    // $15.00 table time + $12.34 in order items = $27.34
    expect(screen.getByText("$27.34")).toBeInTheDocument()
  })
})
