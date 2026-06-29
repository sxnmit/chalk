// Business-day helpers. A venue's day runs 3am→3am in its local timezone, so a
// session at 1am counts toward the previous calendar day. All bounds are
// returned as UTC ISO strings for use in `started_at` range filters.

const CUTOFF_HOUR = 3
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

/** UTC instant of the 3am business-day cutoff on the given venue-local calendar date. */
export function businessDayStartUTC(dateStr: string, timezone: string): Date {
  const boundaryBase = new Date(`${dateStr}T0${CUTOFF_HOUR}:00:00Z`)
  const offsetMs = asUTC(partsAt(boundaryBase, "UTC")) - asUTC(partsAt(boundaryBase, timezone))
  return new Date(boundaryBase.getTime() + offsetMs)
}

/** UTC bounds [gte, lt) of the current business day (3am→3am venue-local). */
export function todayBoundsUTC(timezone: string): { gte: string; lt: string } {
  const now = new Date()
  const businessDate =
    hourInTz(now, timezone) < CUTOFF_HOUR
      ? dateStringInTz(new Date(now.getTime() - DAY_MS), timezone)
      : dateStringInTz(now, timezone)
  const start = businessDayStartUTC(businessDate, timezone)
  return { gte: start.toISOString(), lt: new Date(start.getTime() + DAY_MS).toISOString() }
}

/**
 * UTC bounds [gte, lt) covering venue-local business days `from`..`to` inclusive.
 * `from` and `to` are plain `YYYY-MM-DD` calendar dates (the days the owner picked).
 */
export function businessDayRangeUTC(
  from: string,
  to: string,
  timezone: string,
): { gte: string; lt: string } {
  return {
    gte: businessDayStartUTC(from, timezone).toISOString(),
    lt: businessDayStartUTC(addDays(to, 1), timezone).toISOString(),
  }
}
