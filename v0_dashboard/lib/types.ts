export interface Rate {
  id: string
  name: string
  pricePerHour: number
  isDefault?: boolean
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

export const RATES: Rate[] = [
  { id: "standard", name: "Standard", pricePerHour: 15 },
  { id: "peak", name: "Peak (Fri-Sat)", pricePerHour: 20 },
  { id: "happy-hour", name: "Happy Hour", pricePerHour: 10 },
]

export function getDefaultRate(): Rate {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()

  // Happy hour: weekdays 4-6pm
  if (day >= 1 && day <= 5 && hour >= 16 && hour < 18) {
    return RATES.find((r) => r.id === "happy-hour")!
  }

  // Peak: Friday and Saturday evenings
  if ((day === 5 || day === 6) && hour >= 18) {
    return RATES.find((r) => r.id === "peak")!
  }

  return RATES.find((r) => r.id === "standard")!
}

export function calculateAmountOwed(
  startTime: Date,
  pricePerHour: number
): number {
  const now = new Date()
  const durationMs = now.getTime() - startTime.getTime()
  const durationHours = durationMs / (1000 * 60 * 60)
  return Math.max(0, durationHours * pricePerHour)
}

export function formatDuration(startTime: Date, endTime?: Date): string {
  const end = endTime || new Date()
  const durationMs = end.getTime() - startTime.getTime()
  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}
