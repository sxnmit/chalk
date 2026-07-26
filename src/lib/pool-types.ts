export interface Rate {
  id: string
  name: string
  pricePerHour: number
  isDefault: boolean
  isPeakRate: boolean
  isActive: boolean
}

export interface PeakSchedule {
  days: number[]     // 0=Sun..6=Sat
  startHour: number  // 0-23, inclusive
  endHour: number    // 0-23, exclusive; if < startHour, window wraps past midnight
}

export const DEFAULT_PEAK_SCHEDULE: PeakSchedule = {
  days: [5, 6],
  startHour: 20,
  endHour: 3,
}

export interface TableSession {
  id: string
  tableId: string
  playerName?: string
  rateId: string
  actualRateCharged: number
  startTime: Date
  endTime?: Date
}

export interface PoolTable {
  id: string
  name: string
  tableNumber: number
  defaultRateId?: string
  session?: TableSession
}

export function isPeakHour(date: Date, schedule: PeakSchedule = DEFAULT_PEAK_SCHEDULE): boolean {
  const day = date.getDay()
  const hour = date.getHours()
  return matchesPeakWindow(day, hour, schedule)
}

function matchesPeakWindow(day: number, hour: number, schedule: PeakSchedule): boolean {
  const { days, startHour, endHour } = schedule
  if (days.length === 0) return false
  const wraps = endHour <= startHour
  for (const d of days) {
    if (wraps) {
      if (day === d && hour >= startHour) return true
      if (day === (d + 1) % 7 && hour < endHour) return true
    } else {
      if (day === d && hour >= startHour && hour < endHour) return true
    }
  }
  return false
}

export function calculateAmountOwed(
  startTime: Date,
  rate: Rate | undefined,
  peakRate: number,
  endTime?: Date,
  schedule: PeakSchedule = DEFAULT_PEAK_SCHEDULE,
): number {
  if (!rate) return 0
  const end = endTime ?? new Date()

  if (rate.pricePerHour >= peakRate) {
    const hours = (end.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    return Math.max(0, hours * rate.pricePerHour)
  }

  let total = 0
  let hourStart = new Date(startTime)

  while (hourStart < end) {
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
    const billingEnd = hourEnd <= end ? hourEnd : end
    const fraction = (billingEnd.getTime() - hourStart.getTime()) / (1000 * 60 * 60)
    const hourlyRate = isPeakHour(hourStart, schedule) ? peakRate : rate.pricePerHour
    total += fraction * hourlyRate
    hourStart = hourEnd
  }

  return Math.max(0, total)
}

export function formatDuration(startTime: Date, endTime?: Date): string {
  const end = endTime ?? new Date()
  const totalSeconds = Math.floor((end.getTime() - startTime.getTime()) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":")
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatCurrency(amount: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  }).format(amount)
}
