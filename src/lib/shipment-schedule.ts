// Cadence math for stock_shipments. Shipments fire either on selected
// days-of-week or every N days, always at a chosen local hour in the venue's
// timezone. `next_run_at` is stored as a UTC timestamp; we recompute it here
// after inserts and after each cron run.
//
// Timezone conversion uses only Intl.DateTimeFormat so we don't drag in a
// tz library. Precision target: match the venue's local hour within 1
// minute across DST transitions -- the cron runs hourly so sub-minute jitter
// doesn't matter, but the *hour* has to be right in local time.

export type CadenceType = "weekly" | "interval"
export type ShipmentAction = "add" | "set"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

interface LocalParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  dow: number   // 0=Sun..6=Sat
}

const DOW_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

function getLocalParts(instant: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short", hourCycle: "h23",
  })
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value
  }
  return {
    year:   parseInt(parts.year, 10),
    month:  parseInt(parts.month, 10),
    day:    parseInt(parts.day, 10),
    hour:   parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    dow:    DOW_INDEX[parts.weekday] ?? 0,
  }
}

// Turn a wall-clock time in `timezone` into a UTC Date. Two-pass adjustment
// handles DST boundaries -- on a "spring forward" day the wall-clock hour we
// want may not exist, in which case we accept the first valid instant after.
function zonedTimeToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number, timezone: string,
): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const guessParts = getLocalParts(new Date(guessUtc), timezone)
  const guessAsUtc = Date.UTC(
    guessParts.year, guessParts.month - 1, guessParts.day,
    guessParts.hour, guessParts.minute, guessParts.second,
  )
  const offset = guessAsUtc - guessUtc
  const adjusted = guessUtc - offset

  const adjParts = getLocalParts(new Date(adjusted), timezone)
  const adjAsUtc = Date.UTC(
    adjParts.year, adjParts.month - 1, adjParts.day,
    adjParts.hour, adjParts.minute, adjParts.second,
  )
  const secondOffset = adjAsUtc - adjusted
  return new Date(adjusted - (secondOffset - offset))
}

export interface CadenceInput {
  cadenceType: CadenceType
  weeklyDays?: number[] | null
  intervalDays?: number | null
  runHour: number
  timezone: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Compute the next UTC firing time for a shipment.
 *
 * - Weekly: the next `weeklyDays` slot at `runHour` local, strictly after `from`.
 * - Interval: `base + intervalDays * 24h` snapped to `runHour` local. `base`
 *   is `lastRunAt` when present, otherwise `from` -- so a brand-new interval
 *   shipment first fires N days after creation, not immediately.
 * - Past-date guard: if a cron outage means the naive next slot is already in
 *   the past, we advance to the next future slot rather than backfilling a
 *   flood of missed runs -- a missed weekly restock is a no-op, not something
 *   to make up for.
 */
export function computeNextRun(
  input: CadenceInput,
  from: Date = new Date(),
  lastRunAt: Date | null = null,
): Date {
  const { cadenceType, timezone, runHour } = input

  if (cadenceType === "weekly") {
    const days = (input.weeklyDays ?? []).slice().sort((a, b) => a - b)
    if (days.length === 0) {
      throw new Error("weekly cadence requires at least one weekly_days entry")
    }
    for (let offset = 0; offset < 14; offset++) {
      const probe = new Date(from.getTime() + offset * DAY_MS)
      const parts = getLocalParts(probe, timezone)
      if (!days.includes(parts.dow)) continue
      const target = zonedTimeToUtc(parts.year, parts.month, parts.day, runHour, 0, timezone)
      if (target.getTime() > from.getTime()) return target
    }
    // Extremely unlikely -- 14 days of scanning failed. Fall back to +7 days.
    return new Date(from.getTime() + 7 * DAY_MS)
  }

  const days = input.intervalDays ?? 0
  if (days < 1) {
    throw new Error("interval cadence requires interval_days >= 1")
  }
  const base = lastRunAt ?? from
  let candidate = snapToLocalHour(new Date(base.getTime() + days * DAY_MS), runHour, timezone)
  // Advance past `from` if we're catching up after downtime.
  let guard = 0
  while (candidate.getTime() <= from.getTime() && guard++ < 3650) {
    candidate = snapToLocalHour(new Date(candidate.getTime() + days * DAY_MS), runHour, timezone)
  }
  return candidate
}

function snapToLocalHour(instant: Date, runHour: number, timezone: string): Date {
  const parts = getLocalParts(instant, timezone)
  return zonedTimeToUtc(parts.year, parts.month, parts.day, runHour, 0, timezone)
}

/** Human-readable cadence summary for the admin list, e.g. "Every Mon, Thu at 6:00 AM". */
export function formatCadence(input: CadenceInput): string {
  const hourLabel = formatHour(input.runHour)
  if (input.cadenceType === "weekly") {
    const days = (input.weeklyDays ?? []).slice().sort((a, b) => a - b)
    if (days.length === 0) return `Weekly at ${hourLabel}`
    if (days.length === 7) return `Every day at ${hourLabel}`
    return `Every ${days.map((d) => DAY_LABELS[d]).join(", ")} at ${hourLabel}`
  }
  const n = input.intervalDays ?? 0
  if (n === 1) return `Every day at ${hourLabel}`
  return `Every ${n} days at ${hourLabel}`
}

export function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM"
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return "12:00 PM"
  return `${hour - 12}:00 PM`
}

export function formatNextRunInTimezone(nextRunAt: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(nextRunAt)
}
