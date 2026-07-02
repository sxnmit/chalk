// Business-day helpers. A venue's day runs 3am→3am in its local timezone, so a
// session at 1am counts toward the previous calendar day. All bounds are
// returned as UTC ISO strings for use in `started_at` range filters.

const DEFAULT_CUTOFF_HOUR = 3
const DAY_MS = 24 * 60 * 60 * 1000

function partsAt(d: Date, tz: string): Record<string, number> {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, number>>((acc, { type, value }) => {
      if (type !== "literal") acc[type] = parseInt(value, 10)
      return acc
    }, {})
}

const asUTC = (p: Record<string, number>) =>
  Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)

function dateStringInTz(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d)
}

function hourInTz(d: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "2-digit", hour12: false,
  }).formatToParts(d)
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "00", 10)
}

/** Shift a plain `YYYY-MM-DD` calendar date by `n` days (pure date math, tz-agnostic). */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function businessDayStartUTC(dateStr: string, timezone: string, cutoffHour = DEFAULT_CUTOFF_HOUR): Date {
  const hourStr = String(cutoffHour).padStart(2, "0")
  const boundaryBase = new Date(`${dateStr}T${hourStr}:00:00Z`)
  const offsetMs = asUTC(partsAt(boundaryBase, "UTC")) - asUTC(partsAt(boundaryBase, timezone))
  return new Date(boundaryBase.getTime() + offsetMs)
}

/** Venue-local business-day date (`YYYY-MM-DD`) for a UTC instant — an instant before the cutoff counts toward the previous calendar day. */
export function businessDayOf(d: Date, timezone: string, cutoffHour = DEFAULT_CUTOFF_HOUR): string {
  return hourInTz(d, timezone) < cutoffHour
    ? dateStringInTz(new Date(d.getTime() - DAY_MS), timezone)
    : dateStringInTz(d, timezone)
}

export function todayBoundsUTC(timezone: string, cutoffHour = DEFAULT_CUTOFF_HOUR): { gte: string; lt: string } {
  const start = businessDayStartUTC(businessDayOf(new Date(), timezone, cutoffHour), timezone, cutoffHour)
  return { gte: start.toISOString(), lt: new Date(start.getTime() + DAY_MS).toISOString() }
}

/** Venue-local `YYYY-MM-DD HH:mm:ss` for a UTC instant. */
export function formatLocalDateTime(d: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, { type, value }) => {
      if (type !== "literal") acc[type] = value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

/**
 * UTC bounds [gte, lt) covering venue-local business days `from`..`to` inclusive.
 * `from` and `to` are plain `YYYY-MM-DD` calendar dates (the days the owner picked).
 */
export function businessDayRangeUTC(
  from: string,
  to: string,
  timezone: string,
  cutoffHour = DEFAULT_CUTOFF_HOUR,
): { gte: string; lt: string } {
  return {
    gte: businessDayStartUTC(from, timezone, cutoffHour).toISOString(),
    lt: businessDayStartUTC(addDays(to, 1), timezone, cutoffHour).toISOString(),
  }
}
