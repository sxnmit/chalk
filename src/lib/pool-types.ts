export interface Rate {
  id: string
  name: string
  pricePerHour: number
  isDefault: boolean
  isPeakRate: boolean
}

export interface TableSession {
  id: string
  tableId: string
  playerName?: string
  rateId: string
  startTime: Date
  endTime?: Date
}

export interface PoolTable {
  id: string
  name: string
  tableNumber: number
  session?: TableSession
}

// Peak hours: Fri–Sat 8 pm – 3 am (anchored to local time)
export function isPeakHour(date: Date): boolean {
  const day = date.getDay()  // 0=Sun … 5=Fri, 6=Sat
  const hour = date.getHours()
  return (
    (day === 5 && hour >= 20) ||  // Fri 8 pm →
    (day === 6 && hour < 3)  ||  // Sat before 3 am (Fri night)
    (day === 6 && hour >= 20) ||  // Sat 8 pm →
    (day === 0 && hour < 3)       // Sun before 3 am (Sat night)
  )
}

export function calculateAmountOwed(
  startTime: Date,
  rate: Rate | undefined,
  peakRate: number,
  endTime?: Date
): number {
  if (!rate) return 0
  const end = endTime ?? new Date()

  // Flat billing: non-league and any rate already at/above peak price
  if (rate.pricePerHour >= peakRate) {
    const hours = (end.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    return Math.max(0, hours * rate.pricePerHour)
  }

  // League billing: walk billing hours anchored to session start.
  // Rate for each hour is determined by whether that hour's START falls in peak time.
  // This implements the overlap rule: a non-peak hour that crosses 8 pm stays at the
  // lower rate until the next billing hour boundary.
  let total = 0
  let hourStart = new Date(startTime)

  while (hourStart < end) {
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
    const billingEnd = hourEnd <= end ? hourEnd : end
    const fraction = (billingEnd.getTime() - hourStart.getTime()) / (1000 * 60 * 60)
    const hourlyRate = isPeakHour(hourStart) ? peakRate : rate.pricePerHour
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

// Created once — Intl constructors are expensive to instantiate on every call.
const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return USD_FORMATTER.format(amount)
}
