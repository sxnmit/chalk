"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export interface RevenueData {
  totalRevenue: number
  sessionCount: number
  avgSessionMinutes: number
  peakHours: { hour: number; count: number }[]
  tierBreakdown: { label: string; sessionCount: number; revenue: number }[]
}

export async function loadRevenueData(from: string, to: string): Promise<RevenueData> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("venue_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "owner") redirect("/dashboard")

  const { data: venue } = await supabase
    .from("venues")
    .select("timezone")
    .eq("id", profile.venue_id)
    .single()

  const timezone = venue?.timezone ?? "UTC"

  const { data: tables } = await supabase
    .from("tables")
    .select("id")
    .eq("venue_id", profile.venue_id)

  const tableIds = (tables ?? []).map((t) => t.id)
  if (tableIds.length === 0) return emptyData()

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, started_at, ended_at, actual_rate_charged, rates(label)")
    .in("table_id", tableIds)
    .not("ended_at", "is", null)
    .gte("started_at", from)
    .lt("started_at", to)

  if (error) throw error

  const rows = sessions ?? []

  let totalRevenue = 0
  let totalMinutes = 0
  const hourCounts = new Array(24).fill(0)
  const tierMap = new Map<string, { sessionCount: number; revenue: number }>()

  for (const s of rows) {
    if (!s.ended_at) continue

    const startMs = new Date(s.started_at).getTime()
    const endMs = new Date(s.ended_at).getTime()
    const hours = (endMs - startMs) / (1000 * 60 * 60)
    const revenue = hours * Number(s.actual_rate_charged)

    totalRevenue += revenue
    totalMinutes += hours * 60

    // Venue-local hour for peak hours chart
    const hourStr =
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false })
        .formatToParts(new Date(s.started_at))
        .find((p) => p.type === "hour")?.value ?? "0"
    hourCounts[parseInt(hourStr, 10)]++

    const label = (s.rates as unknown as { label: string } | null)?.label ?? "Other"
    const prev = tierMap.get(label) ?? { sessionCount: 0, revenue: 0 }
    tierMap.set(label, { sessionCount: prev.sessionCount + 1, revenue: prev.revenue + revenue })
  }

  return {
    totalRevenue,
    sessionCount: rows.length,
    avgSessionMinutes: rows.length > 0 ? totalMinutes / rows.length : 0,
    peakHours: hourCounts.map((count, hour) => ({ hour, count })),
    tierBreakdown: [...tierMap.entries()]
      .map(([label, d]) => ({ label, ...d }))
      .sort((a, b) => b.revenue - a.revenue),
  }
}

function emptyData(): RevenueData {
  return {
    totalRevenue: 0,
    sessionCount: 0,
    avgSessionMinutes: 0,
    peakHours: new Array(24).fill(0).map((_, hour) => ({ hour, count: 0 })),
    tierBreakdown: [],
  }
}
