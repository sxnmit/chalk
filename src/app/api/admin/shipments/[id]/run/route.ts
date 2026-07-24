import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { withAuditContext } from "@/lib/audit"

const ADMIN_ROLES = ["owner", "manager"]

// Manual "Run now" -- applies the shipment's stock changes immediately without
// touching next_run_at, so the next scheduled firing still happens on time.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { venueId, role, userId } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id } = await params

    const { data: shipment, error: fetchErr } = await supabase
      .from("stock_shipments")
      .select("id, venue_id")
      .eq("id", id)
      .eq("venue_id", venueId)
      .maybeSingle()
    if (fetchErr) {
      console.error("shipment run fetch error", fetchErr)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
    if (!shipment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const results = await withAuditContext(
      supabase,
      { source: "shipment_manual", shipment_id: id, triggered_by: userId },
      async () => {
        const { data, error } = await supabase.rpc("apply_shipment_stock", {
          p_shipment_id: id,
        })
        if (error) throw error
        return data as Array<{ menu_item_id: string; applied_quantity: number; skipped: boolean }>
      },
    )

    const { error: touchErr } = await supabase
      .from("stock_shipments")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", id)
      .eq("venue_id", venueId)
    if (touchErr) {
      console.error("shipment run touch error", touchErr)
    }

    return NextResponse.json({
      applied: results.filter((r) => !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
    })
  } catch (error) {
    console.error("shipment run error", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
