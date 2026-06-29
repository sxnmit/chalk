// Server-side table-time billing. Mirrors `calculateAmountOwed()` in
// pool-types.ts, but resolves the peak window in the venue's timezone — the
// server runs in UTC, so Date.getHours()/getDay() can't be used — and returns
// cents. This is the canonical charge applied at checkout.

import type { createClient } from "@/utils/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

const HOUR_MS = 60 * 60 * 1000

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** Peak window — Fri 8pm → Sun 3am — evaluated in the venue's local time. */
export function isPeakHourInTz(ms: number, timezone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ms))
  const day = WEEKDAY_INDEX[parts.find((p) => p.type === "weekday")?.value ?? "Sun"]
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)
  return (
    (day === 5 && hour >= 20) || // Fri 8pm →
    (day === 6 && hour < 3) ||   // Sat before 3am (Fri night)
    (day === 6 && hour >= 20) || // Sat 8pm →
    (day === 0 && hour < 3)      // Sun before 3am (Sat night)
  )
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
    const hourlyRate = isPeakHourInTz(hourStart, timezone) ? peakRate : ratePerHour
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
    supabase.from("venues").select("timezone").eq("id", venueId).single(),
    supabase.from("rates").select("hourly_rate").eq("venue_id", venueId),
  ])

  const timezone = venue?.timezone ?? "UTC"
  const peakRate = (rates ?? []).reduce((max, r) => Math.max(max, Number(r.hourly_rate)), 0)

  return tableTotalCents(
    new Date(startedAt).getTime(),
    endMs,
    Number(actualRateCharged),
    peakRate,
    timezone,
  )
}
