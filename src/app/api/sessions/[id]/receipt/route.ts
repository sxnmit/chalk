import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId } = await params
    const paymentId = request.nextUrl.searchParams.get("payment_id")

    if (!paymentId) return NextResponse.json({ error: "payment_id is required" }, { status: 400 })

    const [{ data: payment, error: paymentErr }, { data: session, error: sessionErr }] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .eq("session_id", sessionId)
        .eq("venue_id", venueId)
        .single(),
      supabase
        .from("sessions")
        .select("*, tables(name), venues(name), rates(label)")
        .eq("id", sessionId)
        .eq("venue_id", venueId)
        .single(),
    ])

    if (paymentErr || sessionErr || !payment || !session) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    const { data: orderItems, error: itemsErr } = await supabase
      .from("order_items")
      .select("*, menu_items(name)")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)

    if (itemsErr) return NextResponse.json({ error: "Internal server error" }, { status: 500 })

    const startedAt = session.started_at
    const endedAt = session.ended_at ?? new Date().toISOString()
    const durationMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
    )
    const tables = session.tables as unknown as { name: string } | null
    const venues = session.venues as unknown as { name: string } | null

    const isTab = session.table_id === null

    return NextResponse.json({
      venueName: venues?.name ?? "Venue",
      receiptNumber: paymentId.slice(-8).toUpperCase(),
      createdAt: payment.created_at,
      tableName: tables?.name ?? (isTab ? (session.player_name || "Tab") : "Table"),
      isTab,
      startedAt,
      endedAt,
      durationMinutes,
      actualRateCharged: session.actual_rate_charged == null ? 0 : Number(session.actual_rate_charged),
      orderItems: (orderItems ?? []).map((item) => ({
        name: (item.menu_items as unknown as { name: string } | null)?.name ?? "Item",
        quantity: item.quantity,
        price_at_time_cents: item.price_at_time_cents,
        line_total_cents: item.quantity * item.price_at_time_cents,
      })),
      tableTotalCents: payment.table_total_cents,
      itemsTotalCents: payment.items_total_cents,
      taxCents: payment.tax_cents,
      tipCents: payment.tip_cents,
      grandTotalCents: payment.grand_total_cents,
      method: payment.method,
      cardLast4: null,
    })
  } catch (e) {
    console.error("Receipt generation failed:", e)
    const isAuthError = e instanceof Error && e.message === "Not authenticated"
    return NextResponse.json(
      { error: isAuthError ? "Unauthorized" : "Internal server error" },
      { status: isAuthError ? 401 : 500 },
    )
  }
}
