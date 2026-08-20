"use server"

import { createClient } from "@/utils/supabase/server"
import { Rate, PoolTable, TableSession, PeakSchedule } from "@/lib/pool-types"
import { todayBoundsUTC } from "@/lib/business-day"

// ── Today summary (for dashboard header chips) ─────────────────────────────────

async function loadTodaySummaryForVenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { venue_id: string }
): Promise<{ totalRevenue: number; sessionCount: number }> {
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("timezone, business_day_cutoff_hour")
    .eq("id", profile.venue_id)
    .single()
  if (venueError) { console.error("loadTodaySummary venue fetch failed:", venueError); throw new Error("Failed to load summary") }

  const { gte, lt } = todayBoundsUTC(venue.timezone, venue.business_day_cutoff_hour ?? 3)

  // Include both table sessions and tabs (table_id null) for this venue.
  const { data: rows, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, started_at, ended_at, actual_rate_charged")
    .eq("venue_id", profile.venue_id)
    .not("ended_at", "is", null)
    .gte("started_at", gte)
    .lt("started_at", lt)
  if (sessionsError) { console.error("loadTodaySummary sessions fetch failed:", sessionsError); throw new Error("Failed to load summary") }

  const sessions = rows ?? []
  if (sessions.length === 0) return { totalRevenue: 0, sessionCount: 0 }

  const sessionIds = sessions.map((s) => s.id)
  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("session_id, quantity, price_at_time_cents")
    .in("session_id", sessionIds)
  if (itemsError) { console.error("loadTodaySummary items fetch failed:", itemsError); throw new Error("Failed to load summary") }

  const itemsBySession = new Map<string, number>()
  for (const i of itemRows ?? []) {
    const cents = i.quantity * i.price_at_time_cents
    itemsBySession.set(i.session_id, (itemsBySession.get(i.session_id) ?? 0) + cents)
  }

  let totalRevenue = 0
  for (const s of sessions) {
    const hours =
      (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60)
    const rate = s.actual_rate_charged == null ? 0 : Number(s.actual_rate_charged)
    totalRevenue += hours * rate
    totalRevenue += (itemsBySession.get(s.id) ?? 0) / 100
  }

  return { totalRevenue, sessionCount: sessions.length }
}

// Reads venue_id, role, and user id from the JWT. Falls back to a DB lookup
// (venue_members → users) when claims are absent (e.g. token pre-dates the hook).
async function getProfileFromToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error("Not authenticated")

  const { data: { session } } = await supabase.auth.getSession()

  let venueId: string | undefined
  let role: string | undefined

  if (session?.access_token) {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64url").toString()
    )
    venueId = payload.app_metadata?.venue_id as string | undefined
    role = payload.app_metadata?.role as string | undefined
  }

  if (!venueId) {
    const { data: member } = await supabase
      .from("venue_members")
      .select("venue_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (member) {
      venueId = member.venue_id
      role = member.role
    } else {
      const { data: dbUser } = await supabase
        .from("users")
        .select("venue_id, role")
        .eq("id", user.id)
        .maybeSingle()

      if (dbUser) {
        venueId = dbUser.venue_id
        role = dbUser.role
      }
    }
  }

  if (!venueId) throw new Error("User has no venue — ensure onboarding is complete")

  return { venueId, role: role ?? "staff", userId: user.id }
}

// ── Public actions ─────────────────────────────────────────────────────────────

export interface OpenTabItem {
  name: string
  quantity: number
  lineTotalCents: number
}

export interface OpenTab {
  id: string
  playerName: string | null
  startedAt: string
  items: OpenTabItem[]
  totalCents: number
}

export async function loadDashboardData(): Promise<{
  tables: PoolTable[]
  rates: Rate[]
  tabs: OpenTab[]
  userRole: string
  venueName: string
  peakSchedule: PeakSchedule
  currency: string
  todayCompletedSessionsCount: number
  todayRevenue: number
}> {
  const supabase = await createClient()
  const { venueId, role } = await getProfileFromToken(supabase)

  const { data: tables, error: tablesError } = await supabase
    .from("tables")
    .select("id, name, display_order, default_rate_id")
    .eq("venue_id", venueId)
    .in("status", ["free", "occupied"])
    .order("display_order")
  if (tablesError) { console.error("loadDashboardData tables fetch failed:", tablesError); throw new Error("Failed to load dashboard") }

  const [
    { data: sessions, error: sessionsError },
    { data: dbRates, error: ratesError },
    { data: venueRow, error: venueRowError },
    todaySummary,
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, table_id, rate_id, started_at, player_name, actual_rate_charged")
      .eq("venue_id", venueId)
      .is("ended_at", null),
    supabase
      .from("rates")
      .select("id, label, hourly_rate, is_default, active")
      .eq("venue_id", venueId)
      .order("hourly_rate"),
    supabase.from("venues").select("name, peak_days, peak_start_hour, peak_end_hour, currency").eq("id", venueId).single(),
    loadTodaySummaryForVenue(supabase, { venue_id: venueId }),
  ])

  if (sessionsError) { console.error("loadDashboardData sessions fetch failed:", sessionsError); throw new Error("Failed to load dashboard") }
  if (ratesError) { console.error("loadDashboardData rates fetch failed:", ratesError); throw new Error("Failed to load dashboard") }
  if (venueRowError) { console.error("loadDashboardData venue fetch failed:", venueRowError); throw new Error("Failed to load dashboard") }

  // Active rates are selectable for new sessions; deactivated rates are kept
  // only if a currently-active session still references one, so its name and
  // pricing can still render until the session ends.
  const activeSessionRateIds = new Set(
    (sessions ?? []).map((s) => s.rate_id).filter((id): id is string => !!id),
  )
  const visibleRates = (dbRates ?? []).filter(
    (r) => r.active || activeSessionRateIds.has(r.id),
  )

  const rates: Rate[] = visibleRates.map((r) => ({
    id: r.id,
    name: r.label,
    pricePerHour: Number(r.hourly_rate),
    isDefault: r.is_default,
    isPeakRate: r.label.toLowerCase().includes("peak"),
    isActive: r.active,
  }))

  const sessionsList = sessions ?? []
  const tableSessions = sessionsList.filter((s) => s.table_id !== null)
  const tabSessions = sessionsList.filter((s) => s.table_id === null)

  const sessionByTableId = new Map(tableSessions.map((s) => [s.table_id, s]))

  const tableSessionIds = tableSessions.map((s) => s.id)
  const { data: tableItemRows, error: tableItemsError } =
    tableSessionIds.length > 0
      ? await supabase
          .from("order_items")
          .select("session_id, quantity, price_at_time_cents")
          .eq("venue_id", venueId)
          .in("session_id", tableSessionIds)
      : { data: [], error: null }
  if (tableItemsError) { console.error("loadDashboardData table items fetch failed:", tableItemsError); throw new Error("Failed to load dashboard") }

  const itemsCentsByTableSession = new Map<string, number>()
  for (const i of tableItemRows ?? []) {
    const cents = i.quantity * i.price_at_time_cents
    itemsCentsByTableSession.set(i.session_id, (itemsCentsByTableSession.get(i.session_id) ?? 0) + cents)
  }

  const tabs: OpenTab[] = tabSessions
    .map((s) => ({
      id: s.id,
      playerName: s.player_name ?? null,
      startedAt: s.started_at,
      items: [],
      totalCents: 0,
    }))
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  const poolTables: PoolTable[] = (tables ?? []).map((t) => {
    const dbSession = sessionByTableId.get(t.id)
    const session: TableSession | undefined = dbSession
      ? {
          id: dbSession.id,
          tableId: t.id,
          rateId: dbSession.rate_id,
          actualRateCharged: Number(dbSession.actual_rate_charged ?? 0),
          itemsTotalCents: itemsCentsByTableSession.get(dbSession.id) ?? 0,
          startTime: new Date(dbSession.started_at),
          playerName: dbSession.player_name ?? undefined,
        }
      : undefined

    return {
      id: t.id,
      name: t.name,
      tableNumber: t.display_order,
      defaultRateId: t.default_rate_id ?? undefined,
      session,
    }
  })

  const peakSchedule: PeakSchedule = {
    days: venueRow?.peak_days ?? [5, 6],
    startHour: venueRow?.peak_start_hour ?? 20,
    endHour: venueRow?.peak_end_hour ?? 3,
  }

  return {
    tables: poolTables,
    rates,
    tabs,
    userRole: role,
    venueName: venueRow?.name ?? "",
    peakSchedule,
    currency: venueRow?.currency ?? "CAD",
    todayCompletedSessionsCount: todaySummary.sessionCount,
    todayRevenue: todaySummary.totalRevenue,
  }
}

export async function startTabAction(playerName?: string): Promise<{ id: string }> {
  if (playerName && playerName.length > 30) {
    throw new Error("Name too long")
  }

  const supabase = await createClient()
  const { venueId, userId } = await getProfileFromToken(supabase)

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      table_id: null,
      rate_id: null,
      staff_id: userId,
      venue_id: venueId,
      started_at: new Date().toISOString(),
      actual_rate_charged: 0,
      player_name: playerName?.trim() || null,
    })
    .select("id")
    .single()

  if (error || !data) throw error ?? new Error("Failed to start tab")
  return { id: data.id }
}

export async function startSessionAction(
  tableId: string,
  rateId: string,
  playerName?: string
): Promise<void> {
  if (playerName && playerName.length > 30) {
    throw new Error("Name too long")
  }

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

  if (insertError) { console.error("startSessionAction insert failed:", insertError); throw new Error("Failed to start session") }
  if (tableError) { console.error("startSessionAction table update failed:", tableError); throw new Error("Failed to start session") }
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

  if (sessionError) { console.error("endSessionAction session update failed:", sessionError); throw new Error("Failed to end session") }
  if (tableError) { console.error("endSessionAction table update failed:", tableError); throw new Error("Failed to end session") }
}
