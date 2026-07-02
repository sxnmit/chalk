import type { createClient } from "@/utils/supabase/server"
import type { PeakSchedule } from "@/lib/pool-types"
import { DEFAULT_PEAK_SCHEDULE } from "@/lib/pool-types"

type Supabase = Awaited<ReturnType<typeof createClient>>

const HOUR_MS = 60 * 60 * 1000

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

export function isPeakHourInTz(
  ms: number,
  timezone: string,
  schedule: PeakSchedule = DEFAULT_PEAK_SCHEDULE,
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ms))
  const day = WEEKDAY_INDEX[parts.find((p) => p.type === "weekday")?.value ?? "Sun"]
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)

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

/**
 * Table-time charge in cents for [startMs, endMs).
 * - Rates already at/above the peak rate bill flat (continuous).
 * - Lower (league) rates bill on whole-hour boundaries anchored to the session
 *   start; each hour is priced at the peak rate when that hour *begins* in the
 *   peak window. Matches calculateAmountOwed().
 */
export function tableTotalCents(
  startMs: number,
  endMs: number,
  ratePerHour: number,
  peakRate: number,
  timezone: string,
  schedule: PeakSchedule = DEFAULT_PEAK_SCHEDULE,
): number {
  if (endMs <= startMs) return 0

  if (ratePerHour >= peakRate) {
    const hours = (endMs - startMs) / HOUR_MS
    return Math.round(hours * ratePerHour * 100)
  }

  let total = 0
  let hourStart = startMs
  while (hourStart < endMs) {
    const hourEnd = hourStart + HOUR_MS
    const billingEnd = Math.min(hourEnd, endMs)
    const fraction = (billingEnd - hourStart) / HOUR_MS
    const hourlyRate = isPeakHourInTz(hourStart, timezone, schedule) ? peakRate : ratePerHour
    total += fraction * hourlyRate
    hourStart = hourEnd
  }
  return Math.round(total * 100)
}

/**
 * Fetch the venue's timezone + peak rate, then bill a session's table time.
 * `peakRate` is the highest hourly rate across the venue's rates — the same
 * definition callers use on the client.
 */
export async function sessionTableTotalCents(
  supabase: Supabase,
  venueId: string,
  startedAt: string,
  actualRateCharged: number,
  endMs: number,
): Promise<number> {
  const [{ data: venue }, { data: rates }] = await Promise.all([
    supabase.from("venues").select("timezone, peak_days, peak_start_hour, peak_end_hour").eq("id", venueId).single(),
    supabase.from("rates").select("hourly_rate").eq("venue_id", venueId),
  ])

  const timezone = venue?.timezone ?? "UTC"
  const peakRate = (rates ?? []).reduce((max, r) => Math.max(max, Number(r.hourly_rate)), 0)
  const schedule: PeakSchedule = venue?.peak_days
    ? { days: venue.peak_days, startHour: venue.peak_start_hour, endHour: venue.peak_end_hour }
    : DEFAULT_PEAK_SCHEDULE

  return tableTotalCents(
    new Date(startedAt).getTime(),
    endMs,
    Number(actualRateCharged),
    peakRate,
    timezone,
    schedule,
  )
}
