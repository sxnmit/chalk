"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getProfile } from "@/lib/auth"
import { businessDayRangeUTC, businessDayOf, formatLocalDateTime } from "@/lib/business-day"
import { formatAuditDiff } from "@/lib/audit"

type Supabase = Awaited<ReturnType<typeof createClient>>

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
  currency: string
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
    .select("timezone, business_day_cutoff_hour, currency")
    .eq("id", venueId)
    .single()

  const timezone = venue?.timezone ?? "UTC"
  const cutoffHour = venue?.business_day_cutoff_hour ?? 3
  const { gte, lt } = businessDayRangeUTC(from, to, timezone, cutoffHour)

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
    currency: venue?.currency ?? "CAD",
  }
}

// ── CSV export ─────────────────────────────────────────────────────────────────

interface ExportSessionEmbed {
  started_at: string
  ended_at: string | null
  player_name: string | null
  table_id: string | null
  rates: { label: string } | null
  tables: { name: string } | null
}

const CSV_HEADER = [
  "Date", "Table", "Player", "Rate", "Start", "End", "Duration (hrs)",
  "Table ($)", "Items ($)", "Tax ($)", "Tip ($)", "Total ($)", "Payment Method",
]

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",")
}

const TOTAL_COL_INDEX = CSV_HEADER.indexOf("Total ($)")

/** A row with a single label in column 0 and everything else blank (section titles, notes). */
function labelRow(label: string): string[] {
  return [label, ...new Array(CSV_HEADER.length - 1).fill("")]
}

function subtotalRow(totalCents: number): string[] {
  const row = new Array(CSV_HEADER.length).fill("")
  row[0] = "Subtotal"
  row[TOTAL_COL_INDEX] = (totalCents / 100).toFixed(2)
  return row
}

/**
 * CSV of completed, paid sessions for a venue over a date range — owner/manager
 * only. `from`/`to` are plain `YYYY-MM-DD` calendar dates (inclusive), matching
 * the same 3am→3am venue-local business day used by `loadRevenueData`.
 */
export async function exportSessionsCsvAction(
  from: string,
  to: string
): Promise<{ filename: string; csv: string }> {
  const supabase = await createClient()
  const { venueId, role } = await getProfile()
  if (role !== "owner" && role !== "manager") throw new Error("Not authorized")

  if (!from || !to) throw new Error("Both from and to dates are required")
  if (from > to) throw new Error("Start date must be on or before end date")
  const spanDays =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000)
  if (spanDays > 366) throw new Error("Date range cannot exceed 1 year")

  const { data: venue } = await supabase
    .from("venues")
    .select("name, timezone")
    .eq("id", venueId)
    .single()

  const timezone = venue?.timezone ?? "UTC"
  const { gte, lt } = businessDayRangeUTC(from, to, timezone)

  const { data: payments, error } = await supabase
    .from("payments")
    .select(
      "grand_total_cents, table_total_cents, items_total_cents, tax_cents, tip_cents, method, sessions!inner(started_at, ended_at, player_name, table_id, rates(label), tables(name))"
    )
    .eq("venue_id", venueId)
    .eq("status", "succeeded")
    .gte("sessions.started_at", gte)
    .lt("sessions.started_at", lt)

  if (error) throw error

  const rows = (payments ?? [])
    .map((p) => ({ ...p, session: p.sessions as unknown as ExportSessionEmbed | null }))
    .filter((p): p is typeof p & { session: ExportSessionEmbed } => !!p.session)
    .sort((a, b) => new Date(a.session.started_at).getTime() - new Date(b.session.started_at).getTime())

  const tableRows = rows.filter((p) => p.session.table_id !== null)
  const tabRows = rows.filter((p) => p.session.table_id === null)
  const toDollars = (cents: number) => (cents / 100).toFixed(2)

  const rowFields = (p: (typeof rows)[number]): string[] => {
    const s = p.session
    const start = new Date(s.started_at)
    const end = s.ended_at ? new Date(s.ended_at) : start
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

    return [
      businessDayOf(start, timezone),
      s.tables?.name ?? "",
      s.player_name ?? "",
      s.rates?.label ?? "",
      formatLocalDateTime(start, timezone),
      s.ended_at ? formatLocalDateTime(end, timezone) : "",
      hours.toFixed(2),
      toDollars(p.table_total_cents),
      toDollars(p.items_total_cents),
      toDollars(p.tax_cents),
      toDollars(p.tip_cents),
      toDollars(p.grand_total_cents),
      p.method,
    ]
  }

  const lines = [csvRow(CSV_HEADER)]

  for (const [title, group] of [["Pool Tables", tableRows], ["Bar Tabs", tabRows]] as const) {
    lines.push(csvRow(labelRow(title)))
    if (group.length === 0) {
      lines.push(csvRow(labelRow("No sessions in this range")))
      continue
    }
    for (const p of group) lines.push(csvRow(rowFields(p)))
    lines.push(csvRow(subtotalRow(group.reduce((sum, p) => sum + p.grand_total_cents, 0))))
  }

  const venueSlug = (venue?.name ?? "venue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return {
    filename: `chalk-sessions-${venueSlug}-${from}-to-${to}.csv`,
    csv: lines.join("\r\n"),
  }
}

// ── Audit log CSV export ─────────────────────────────────────────────────────────

interface AuditLogRow {
  created_at: string
  actor_id: string | null
  actor_role: string | null
  entity_type: string
  entity_id: string
  operation: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

const AUDIT_CSV_HEADER = ["Timestamp", "Actor", "Role", "Entity", "Entity ID", "Operation", "Summary of Change"]

/**
 * Maps actor_id -> a display label: the legacy `users.name` when present
 * (real names, e.g. the seeded Shy Lounge accounts), otherwise the signup
 * name captured in auth user_metadata (venue_members-only accounts have no
 * row in `users` — see signup/page.tsx's `options.data.name`), otherwise
 * the account email, otherwise the raw id.
 */
async function resolveActorLabels(supabase: Supabase, actorIds: string[]): Promise<Map<string, string>> {
  const labelById = new Map<string, string>()
  if (actorIds.length === 0) return labelById

  const admin = createAdminClient()
  const [{ data: legacyUsers }, authResults] = await Promise.all([
    supabase.from("users").select("id, name").in("id", actorIds),
    Promise.all(actorIds.map((id) => admin.auth.admin.getUserById(id))),
  ])

  const legacyNameById = new Map((legacyUsers ?? []).map((u) => [u.id, u.name]))

  actorIds.forEach((id, i) => {
    const authUser = authResults[i].data.user
    const authLabel = (authUser?.user_metadata?.name as string | undefined) || authUser?.email
    labelById.set(id, legacyNameById.get(id) ?? authLabel ?? id)
  })

  return labelById
}

/**
 * CSV of the audit log for a venue over a date range — owner only (audit
 * history is more sensitive than aggregate revenue, which owners/managers
 * both see). Same range validation and business-day semantics as
 * exportSessionsCsvAction.
 */
export async function exportAuditLogCsvAction(
  from: string,
  to: string
): Promise<{ filename: string; csv: string }> {
  const supabase = await createClient()
  const { venueId, role } = await getProfile()
  if (role !== "owner") throw new Error("Not authorized")

  if (!from || !to) throw new Error("Both from and to dates are required")
  if (from > to) throw new Error("Start date must be on or before end date")
  const spanDays =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000)
  if (spanDays > 366) throw new Error("Date range cannot exceed 1 year")

  const { data: venue } = await supabase
    .from("venues")
    .select("name, timezone")
    .eq("id", venueId)
    .single()

  const timezone = venue?.timezone ?? "UTC"
  const { gte, lt } = businessDayRangeUTC(from, to, timezone)

  // venue_id is our own filter, not user input — but audit_log also carries
  // its own RLS policy (current_user_venue_id()) as a second, DB-level layer
  // in case this filter is ever dropped in a future edit.
  const { data, error } = await supabase
    .from("audit_log")
    .select("created_at, actor_id, actor_role, entity_type, entity_id, operation, before, after")
    .eq("venue_id", venueId)
    .gte("created_at", gte)
    .lt("created_at", lt)
    .order("created_at", { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as AuditLogRow[]
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))]
  const actorLabelById = await resolveActorLabels(supabase, actorIds)

  const lines = [csvRow(AUDIT_CSV_HEADER)]
  if (rows.length === 0) {
    lines.push(csvRow(["No audit events in this range", "", "", "", "", "", ""]))
  }
  for (const row of rows) {
    lines.push(
      csvRow([
        formatLocalDateTime(new Date(row.created_at), timezone),
        row.actor_id ? actorLabelById.get(row.actor_id) ?? row.actor_id : "System",
        row.actor_role ?? "",
        row.entity_type,
        row.entity_id,
        row.operation,
        formatAuditDiff(row.before, row.after),
      ])
    )
  }

  const venueSlug = (venue?.name ?? "venue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return {
    filename: `chalk-audit-log-${venueSlug}-${from}-to-${to}.csv`,
    csv: lines.join("\r\n"),
  }
}
