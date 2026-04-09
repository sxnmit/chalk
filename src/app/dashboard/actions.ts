"use server"

import { createClient } from "@/utils/supabase/server"
import { Rate, PoolTable, TableSession, sessionAmount } from "@/lib/pool-types"

export interface TodaySession {
  id: string
  tableName: string
  playerName?: string
  rateLabel: string
  startedAt: string
  endedAt: string
  actualRateCharged: number
}

async function loadTodaySummaryForVenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { venue_id: string }
): Promise<{ sessions: TodaySession[]; totalRevenue: number }> {
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("timezone")
    .eq("id", profile.venue_id)
    .single()
  if (venueError) throw venueError

  const { gte, lt } = todayBoundsUTC(venue.timezone)

  const { data: venueTables, error: tablesError } = await supabase
    .from("tables")
    .select("id")
    .eq("venue_id", profile.venue_id)
  if (tablesError) throw tablesError

  const tableIds = (venueTables ?? []).map((t) => t.id)
  if (tableIds.length === 0) return { sessions: [], totalRevenue: 0 }

  const { data: rows, error: sessionsError } = await supabase
    .from("sessions")
    .select(`
      id,
      started_at,
      ended_at,
      actual_rate_charged,
      player_name,
      tables (name),
      rates (label)
    `)
    .in("table_id", tableIds)
    .not("ended_at", "is", null)
    .gte("started_at", gte)
    .lt("started_at", lt)
    .order("ended_at", { ascending: false })
  if (sessionsError) throw sessionsError

  const sessions: TodaySession[] = (rows ?? []).map((s) => {
    const tables = s.tables as unknown as { name: string } | null
    const rates = s.rates as unknown as { label: string } | null
    return {
      id: s.id,
      tableName: tables?.name ?? "Unknown",
      playerName: s.player_name ?? undefined,
      rateLabel: rates?.label ?? "Unknown",
      startedAt: s.started_at,
      endedAt: s.ended_at,
      actualRateCharged: Number(s.actual_rate_charged),
    }
  })

  const totalRevenue = sessions.reduce((sum, s) => sum + sessionAmount(s), 0)
  return { sessions, totalRevenue }
}

// Returns the UTC start/end of the current "business day" for the venue.
// Business day is anchored to 3:00 AM → 3:00 AM local time (bars often close after midnight).
function todayBoundsUTC(timezone: string): { gte: string; lt: string } {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const cutoffHour = 3

  const dateStringInTz = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d) // "YYYY-MM-DD"

  const hourInTz = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d)
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
    return parseInt(hour, 10)
  }

  // If it's before 3am local time, we treat it as part of the previous business day.
  const businessDate =
    hourInTz(now) < cutoffHour ? dateStringInTz(new Date(now.getTime() - dayMs)) : dateStringInTz(now)

  // Compute the UTC offset at the boundary instant by comparing raw component values.
  const partsAt = (d: Date, tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce<Record<string, number>>((acc, { type, value }) => {
        if (type !== "literal") acc[type] = parseInt(value, 10)
        return acc
      }, {})

  const asUTC = (p: Record<string, number>) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)

  // 3am local time expressed as UTC using the offset at that boundary instant.
  const boundaryBase = new Date(`${businessDate}T0${cutoffHour}:00:00Z`)
  const offsetMs = asUTC(partsAt(boundaryBase, "UTC")) - asUTC(partsAt(boundaryBase, timezone))
  const startMs = boundaryBase.getTime() + offsetMs

  return {
    gte: new Date(startMs).toISOString(),
    lt: new Date(startMs + dayMs).toISOString(),
  }
}

// Reads venue_id, role, and user id directly from the JWT — no DB round-trip.
// Decodes the access token payload directly rather than relying on session.user.app_metadata,
// which the Supabase SSR client may not fully populate from custom hook claims.
// Requires the custom_access_token_hook Postgres function to be registered in Supabase.
async function getProfileFromToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const payload = JSON.parse(
    Buffer.from(session.access_token.split('.')[1], 'base64url').toString()
  )

  const venueId = payload.app_metadata?.venue_id as string | undefined
  const role = payload.app_metadata?.role as string | undefined

  if (!venueId || !role) throw new Error("Missing claims in token — ensure custom_access_token_hook is registered in Supabase")

  return { venueId, role, userId: session.user.id }
}

export async function loadDashboardData(): Promise<{
  tables: PoolTable[]
  rates: Rate[]
  userRole: string
  todayRevenue: number
  todayCompletedSessionsCount: number
}> {
  const supabase = await createClient()
  const { venueId, role } = await getProfileFromToken(supabase)

  const { data: tables, error: tablesError } = await supabase
    .from("tables")
    .select("id, name, display_order")
    .eq("venue_id", venueId)
    .neq("status", "inactive")
    .order("display_order")
  if (tablesError) throw tablesError

  const venueTableIds = (tables ?? []).map((t) => t.id)

  const [
    { data: sessions, error: sessionsError },
    { data: dbRates, error: ratesError },
    todaySummary,
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, table_id, rate_id, started_at, player_name")
      .in("table_id", venueTableIds)
      .is("ended_at", null),
    supabase
      .from("rates")
      .select("id, label, hourly_rate, is_default")
      .eq("venue_id", venueId)
      .order("hourly_rate"),
    loadTodaySummaryForVenue(supabase, { venue_id: venueId }),
  ])

  if (sessionsError) throw sessionsError
  if (ratesError) throw ratesError

  const rates: Rate[] = (dbRates ?? []).map((r) => ({
    id: r.id,
    name: r.label,
    pricePerHour: Number(r.hourly_rate),
    isDefault: r.is_default,
    isPeakRate: r.label.toLowerCase().includes("peak"),
  }))

  const sessionByTableId = new Map((sessions ?? []).map((s) => [s.table_id, s]))

  const poolTables: PoolTable[] = (tables ?? []).map((t) => {
    const dbSession = sessionByTableId.get(t.id)
    const session: TableSession | undefined = dbSession
      ? {
          id: dbSession.id,
          tableId: t.id,
          rateId: dbSession.rate_id,
          startTime: new Date(dbSession.started_at),
          playerName: dbSession.player_name ?? undefined,
        }
      : undefined

    return {
      id: t.id,
      name: t.name,
      tableNumber: t.display_order,
      session,
    }
  })

  return {
    tables: poolTables,
    rates,
    userRole: role,
    todayRevenue: todaySummary.totalRevenue,
    todayCompletedSessionsCount: todaySummary.sessions.length,
  }
}

export async function loadTodaySessions(): Promise<TodaySession[]> {
  const supabase = await createClient()
  const { venueId } = await getProfileFromToken(supabase)
  const { sessions } = await loadTodaySummaryForVenue(supabase, { venue_id: venueId })
  return sessions
}

export async function startSessionAction(
  tableId: string,
  rateId: string,
  playerName?: string
): Promise<void> {
  const supabase = await createClient()
  const { venueId, userId } = await getProfileFromToken(supabase)

  // Validate table and rate both belong to this venue, and snapshot the rate price
  const [
    { data: table, error: tableCheckError },
    { data: rate, error: rateError },
  ] = await Promise.all([
    supabase.from("tables").select("id").eq("id", tableId).eq("venue_id", venueId).single(),
    supabase.from("rates").select("hourly_rate").eq("id", rateId).eq("venue_id", venueId).single(),
  ])

  if (tableCheckError || !table) throw new Error("Table not found for this venue")
  if (rateError || !rate) throw new Error("Rate not found for this venue")

  const [{ error: insertError }, { error: tableUpdateError }] = await Promise.all([
    supabase.from("sessions").insert({
      table_id: tableId,
      rate_id: rateId,
      staff_id: userId,
      started_at: new Date().toISOString(),
      actual_rate_charged: rate.hourly_rate,
      player_name: playerName || null,
      venue_id: venueId,
    }),
    supabase.from("tables").update({ status: "occupied" }).eq("id", tableId),
  ])

  if (insertError) throw insertError
  if (tableUpdateError) throw tableUpdateError
}

export async function endSessionAction(tableId: string): Promise<void> {
  const supabase = await createClient()
  const { venueId } = await getProfileFromToken(supabase)

  const { data: table, error: tableCheckError } = await supabase
    .from("tables")
    .select("id")
    .eq("id", tableId)
    .eq("venue_id", venueId)
    .single()

  if (tableCheckError || !table) throw new Error("Table not found for this venue")

  const [{ error: sessionError }, { error: tableError }] = await Promise.all([
    supabase
      .from("sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("table_id", tableId)
      .is("ended_at", null),
    supabase.from("tables").update({ status: "free" }).eq("id", tableId),
  ])

  if (sessionError) throw sessionError
  if (tableError) throw tableError
}
