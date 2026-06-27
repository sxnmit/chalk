"use server"

import { createClient } from "@/utils/supabase/server"
import { Rate, PoolTable, TableSession } from "@/lib/pool-types"

// ── Today bounds helper ────────────────────────────────────────────────────────
// Returns the UTC start/end of the current business day (3am→3am local).

function todayBoundsUTC(timezone: string): { gte: string; lt: string } {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const cutoffHour = 3

  const dateStringInTz = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d)

  const hourInTz = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d)
    return parseInt(parts.find((p) => p.type === "hour")?.value ?? "00", 10)
  }

  const businessDate =
    hourInTz(now) < cutoffHour
      ? dateStringInTz(new Date(now.getTime() - dayMs))
      : dateStringInTz(now)

  const partsAt = (d: Date, tz: string) =>
    new Intl.DateTimeFormat("en-US", {
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

  const asUTC = (p: Record<string, number>) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)

  const boundaryBase = new Date(`${businessDate}T0${cutoffHour}:00:00Z`)
  const offsetMs = asUTC(partsAt(boundaryBase, "UTC")) - asUTC(partsAt(boundaryBase, timezone))
  const startMs = boundaryBase.getTime() + offsetMs

  return {
    gte: new Date(startMs).toISOString(),
    lt: new Date(startMs + dayMs).toISOString(),
  }
}

// ── Today summary (for dashboard header chips) ─────────────────────────────────

async function loadTodaySummaryForVenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { venue_id: string }
): Promise<{ totalRevenue: number; sessionCount: number }> {
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
  if (tableIds.length === 0) return { totalRevenue: 0, sessionCount: 0 }

  const { data: rows, error: sessionsError } = await supabase
    .from("sessions")
    .select("started_at, ended_at, actual_rate_charged")
    .in("table_id", tableIds)
    .not("ended_at", "is", null)
    .gte("started_at", gte)
    .lt("started_at", lt)
  if (sessionsError) throw sessionsError

  let totalRevenue = 0
  for (const s of rows ?? []) {
    const hours =
      (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60)
    totalRevenue += hours * Number(s.actual_rate_charged)
  }

  return { totalRevenue, sessionCount: (rows ?? []).length }
}

// Reads venue_id, role, and user id from the JWT. Falls back to a DB lookup
// (venue_members → users) when claims are absent (e.g. token pre-dates the hook).
async function getProfileFromToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const payload = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString()
  )

  let venueId = payload.app_metadata?.venue_id as string | undefined
  let role = payload.app_metadata?.role as string | undefined

  if (!venueId) {
    const { data: member } = await supabase
      .from("venue_members")
      .select("venue_id, role")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (member) {
      venueId = member.venue_id
      role = member.role
    } else {
      const { data: user } = await supabase
        .from("users")
        .select("venue_id, role")
        .eq("id", session.user.id)
        .maybeSingle()

      if (user) {
        venueId = user.venue_id
        role = user.role
      }
    }
  }

  if (!venueId) throw new Error("User has no venue — ensure onboarding is complete")

  return { venueId, role: role ?? "staff", userId: session.user.id }
}

// ── Public actions ─────────────────────────────────────────────────────────────

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
    .in("status", ["free", "occupied"])
    .order("display_order")
  if (tablesError) throw tablesError

  const venueTableIds = (tables ?? []).map((t) => t.id)

  const sessionsQuery = venueTableIds.length > 0
    ? supabase
        .from("sessions")
        .select("id, table_id, rate_id, started_at, player_name")
        .in("table_id", venueTableIds)
        .is("ended_at", null)
    : Promise.resolve({ data: [], error: null })

  const [
    { data: sessions, error: sessionsError },
    { data: dbRates, error: ratesError },
    todaySummary,
  ] = await Promise.all([
    sessionsQuery,
    supabase
      .from("rates")
      .select("id, label, hourly_rate, is_default")
      .eq("venue_id", venueId)
      .eq("active", true)
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
    todayCompletedSessionsCount: todaySummary.sessionCount,
  }
}

export async function startSessionAction(
  tableId: string,
  rateId: string,
  playerName?: string
): Promise<void> {
  const supabase = await createClient()
  const { venueId, userId } = await getProfileFromToken(supabase)

  // Validate table and rate both belong to this venue before mutating anything.
  const [
    { data: table, error: tableCheckError },
    { data: rate, error: rateError },
  ] = await Promise.all([
    supabase.from("tables").select("id").eq("id", tableId).eq("venue_id", venueId).single(),
    supabase.from("rates").select("hourly_rate").eq("id", rateId).eq("venue_id", venueId).single(),
  ])

  if (tableCheckError || !table) throw new Error("Table not found for this venue")
  if (rateError || !rate) throw new Error("Rate not found for this venue")

  const [{ error: insertError }, { error: tableError }] = await Promise.all([
    supabase.from("sessions").insert({
      table_id: tableId,
      rate_id: rateId,
      staff_id: userId,
      venue_id: venueId,
      started_at: new Date().toISOString(),
      actual_rate_charged: rate.hourly_rate,
      player_name: playerName || null,
    }),
    supabase
      .from("tables")
      .update({ status: "occupied" })
      .eq("id", tableId)
      .eq("venue_id", venueId),
  ])

  if (insertError) throw insertError
  if (tableError) throw tableError
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
      .eq("venue_id", venueId)
      .is("ended_at", null),
    supabase
      .from("tables")
      .update({ status: "free" })
      .eq("id", tableId)
      .eq("venue_id", venueId),
  ])

  if (sessionError) throw sessionError
  if (tableError) throw tableError
}
