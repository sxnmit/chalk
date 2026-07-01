"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { businessDayRangeUTC } from "@/lib/business-day"

export interface RevenueData {
  totalRevenue: number        // grand total collected (table + items + tax + tip)
  tableRevenue: number        // pool table time
  itemsRevenue: number        // food & drink
  taxCollected: number
  tipsCollected: number
  sessionCount: number        // number of completed (paid) sessions
  avgSessionMinutes: number
  byMethod: { method: string; count: number; revenue: number }[]
  peakHours: { hour: number; count: number }[]
  tierBreakdown: { label: string; sessionCount: number; revenue: number }[]
}

interface SessionEmbed {
  started_at: string
  ended_at: string | null
  rates: { label: string } | null
}

/**
 * Revenue for a venue over a date range, sourced from the `payments` table —
 * the record of money actually collected. `from` and `to` are plain
 * `YYYY-MM-DD` calendar dates (inclusive); each day runs 3am→3am venue-local,
 * matching the dashboard's "today" definition.
 */
export async function loadRevenueData(from: string, to: string): Promise<RevenueData> {
  const supabase = await createClient()
  const { venueId, role } = await getProfile()
  if (role !== "owner" && role !== "manager") redirect("/dashboard")

  const { data: venue } = await supabase
    .from("venues")
    .select("timezone")
    .eq("id", venueId)
    .single()

  const timezone = venue?.timezone ?? "UTC"
  const { gte, lt } = businessDayRangeUTC(from, to, timezone)

  // Only succeeded payments count as revenue. Filter by the session's start
  // time (inner-joined) so the range matches what staff see per business day.
  const { data: payments, error } = await supabase
    .from("payments")
    .select("grand_total_cents, table_total_cents, items_total_cents, tax_cents, tip_cents, method, sessions!inner(started_at, ended_at, rates(label))")
    .eq("venue_id", venueId)
    .eq("status", "succeeded")
    .gte("sessions.started_at", gte)
    .lt("sessions.started_at", lt)

  if (error) throw error

  const rows = payments ?? []

  let totalRevenue = 0
  let tableRevenue = 0
  let itemsRevenue = 0
  let taxCollected = 0
  let tipsCollected = 0
  let totalMinutes = 0
  let durationCount = 0

  const hourCounts = new Array(24).fill(0)
  const methodMap = new Map<string, { count: number; revenue: number }>()
  const tierMap = new Map<string, { sessionCount: number; revenue: number }>()

  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "2-digit", hourCycle: "h23",
  })
  const localHour = (ms: number) =>
    parseInt(hourFmt.formatToParts(new Date(ms)).find((x) => x.type === "hour")?.value ?? "0", 10)

  for (const p of rows) {
    const session = p.sessions as unknown as SessionEmbed | null

    totalRevenue += p.grand_total_cents - p.tip_cents
    tableRevenue += p.table_total_cents
    itemsRevenue += p.items_total_cents
    taxCollected += p.tax_cents
    tipsCollected += p.tip_cents

    const m = methodMap.get(p.method) ?? { count: 0, revenue: 0 }
    methodMap.set(p.method, { count: m.count + 1, revenue: m.revenue + p.grand_total_cents - p.tip_cents })

    if (session?.started_at && session.ended_at) {
      const sMs = new Date(session.started_at).getTime()
      const eMs = new Date(session.ended_at).getTime()
      totalMinutes += (eMs - sMs) / 60000
      durationCount++

      // Occupancy: count every active hour-slot (anchored to start) by its
      // venue-local hour, so a long session weights the hours it actually spans.
      for (let cursor = sMs; cursor < eMs; cursor += 60 * 60 * 1000) {
        hourCounts[localHour(cursor)]++
      }
    }

    // Rate tiers describe table pricing, so attribute table revenue (not food/tip).
    const label = session?.rates?.label ?? "Other"
    const tier = tierMap.get(label) ?? { sessionCount: 0, revenue: 0 }
    tierMap.set(label, { sessionCount: tier.sessionCount + 1, revenue: tier.revenue + p.table_total_cents })
  }

  const toDollars = (cents: number) => cents / 100

  return {
    totalRevenue: toDollars(totalRevenue),
    tableRevenue: toDollars(tableRevenue),
    itemsRevenue: toDollars(itemsRevenue),
    taxCollected: toDollars(taxCollected),
    tipsCollected: toDollars(tipsCollected),
    sessionCount: rows.length,
    avgSessionMinutes: durationCount > 0 ? totalMinutes / durationCount : 0,
    byMethod: [...methodMap.entries()]
      .map(([method, d]) => ({ method, count: d.count, revenue: toDollars(d.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    peakHours: hourCounts.map((count, hour) => ({ hour, count })),
    tierBreakdown: [...tierMap.entries()]
      .map(([label, d]) => ({ label, sessionCount: d.sessionCount, revenue: toDollars(d.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
  }
}
