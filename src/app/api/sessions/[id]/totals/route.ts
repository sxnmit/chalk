import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId } = await params

    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, venue_id, started_at, actual_rate_charged")
      .eq("id", sessionId)
      .eq("venue_id", venueId)
      .single()

    if (sessionErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("id, menu_item_id, quantity, price_at_time_cents, menu_items(name)")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    const now = new Date()
    const started = new Date(session.started_at)
    const elapsedHours = (now.getTime() - started.getTime()) / (1000 * 60 * 60)
    const tableTotalCents = Math.round(Number(session.actual_rate_charged) * 100 * elapsedHours)

    const orderItems = (items ?? []).map((item) => ({
      id: item.id,
      menu_item_id: item.menu_item_id,
      name: (item.menu_items as unknown as { name: string } | null)?.name ?? "Unknown",
      quantity: item.quantity,
      price_at_time_cents: item.price_at_time_cents,
      line_total_cents: item.quantity * item.price_at_time_cents,
    }))

    const itemsTotalCents = orderItems.reduce((sum, i) => sum + i.line_total_cents, 0)

    return NextResponse.json({
      table_total_cents: tableTotalCents,
      items_total_cents: itemsTotalCents,
      tax_cents: 0,
      tip_cents: 0,
      grand_total_cents: tableTotalCents + itemsTotalCents,
      order_items: orderItems,
      started_at: session.started_at,
      actual_rate_charged: Number(session.actual_rate_charged),
    })
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
