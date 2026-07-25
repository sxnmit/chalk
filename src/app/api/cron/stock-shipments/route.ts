import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { computeNextRun } from "@/lib/shipment-schedule"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Vercel Cron hits this hourly. It picks up every active shipment whose
// next_run_at is due (<= now), applies its stock changes, updates
// last_run_at, and recomputes next_run_at from the venue's timezone. The
// endpoint is idempotent per shipment via the row-lock inside
// apply_shipment_stock -- if two invocations overlap, the second sees the
// updated next_run_at and skips.

interface DueShipment {
  id: string
  venue_id: string
  cadence_type: "weekly" | "interval"
  weekly_days: number[] | null
  interval_days: number | null
  run_hour: number
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error("CRON_SECRET is not configured")
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  const { data: due, error: dueErr } = await admin
    .from("stock_shipments")
    .select("id, venue_id, cadence_type, weekly_days, interval_days, run_hour")
    .eq("active", true)
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(500)

  if (dueErr) {
    console.error("cron due-shipments query error", dueErr)
    return NextResponse.json({ error: "Query failed" }, { status: 500 })
  }

  const shipments = (due ?? []) as DueShipment[]
  if (shipments.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  // Cache venue timezones so we don't re-query per shipment.
  const venueIds = Array.from(new Set(shipments.map((s) => s.venue_id)))
  const { data: venueRows } = await admin
    .from("venues")
    .select("id, timezone")
    .in("id", venueIds)
  const tzByVenue = new Map<string, string>()
  for (const v of venueRows ?? []) tzByVenue.set(v.id, v.timezone ?? "UTC")

  let processed = 0
  const failures: Array<{ id: string; error: string }> = []

  for (const s of shipments) {
    try {
      await admin.rpc("set_audit_context", {
        ctx: { source: "shipment_cron", shipment_id: s.id },
      })

      const { error: rpcErr } = await admin.rpc("apply_shipment_stock", {
        p_shipment_id: s.id,
      })
      if (rpcErr) {
        failures.push({ id: s.id, error: rpcErr.message })
        continue
      }

      const nextRun = computeNextRun(
        {
          cadenceType: s.cadence_type,
          weeklyDays: s.weekly_days,
          intervalDays: s.interval_days,
          runHour: s.run_hour,
          timezone: tzByVenue.get(s.venue_id) ?? "UTC",
        },
        new Date(),
        now,
      )

      const { error: updErr } = await admin
        .from("stock_shipments")
        .update({ last_run_at: now.toISOString(), next_run_at: nextRun.toISOString() })
        .eq("id", s.id)
      if (updErr) {
        failures.push({ id: s.id, error: updErr.message })
        continue
      }

      processed++
    } catch (e) {
      failures.push({ id: s.id, error: e instanceof Error ? e.message : "unknown" })
    }
  }

  if (failures.length > 0) {
    console.error("cron shipment failures", failures)
  }

  return NextResponse.json({ processed, failed: failures.length })
}
