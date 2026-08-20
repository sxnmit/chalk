import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
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
        .select("*, tables(name), rates(label)")
        .eq("id", sessionId)
        .eq("venue_id", venueId)
        .single(),
    ])

    if (paymentErr || sessionErr || !payment || !session) {
      const detail = paymentErr?.message ?? sessionErr?.message ?? "no matching rows"
      console.error("Receipt query failed", { paymentErr, sessionErr })
      return NextResponse.json({ error: "Receipt not found", detail }, { status: 404 })
    }

    const { data: venue } = await supabase
      .from("venues")
      .select("name, receipt_footer, currency")
      .eq("id", venueId)
      .maybeSingle()

    const { data: orderItems, error: itemsErr } = await supabase
      .from("order_items")
      .select("*, menu_items(name)")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)

    if (itemsErr) {
      console.error("Receipt: order_items query failed", itemsErr)
      return NextResponse.json({ error: "Internal server error", detail: "order_items: " + itemsErr.message }, { status: 500 })
    }

    let refunds: { amount_cents: number; reason: string; kind: "refund" | "void" | "comp"; created_at: string }[] = []
    const { data: refundRows, error: refundsErr } = await supabase
      .from("refunds")
      .select("amount_cents, reason, kind, created_at")
      .eq("payment_id", paymentId)
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })

    if (!refundsErr) {
      refunds = (refundRows ?? []).map((r) => ({
        amount_cents: r.amount_cents,
        reason: r.reason,
        kind: r.kind as "refund" | "void" | "comp",
        created_at: r.created_at,
      }))
    }
    const refundedTotalCents = refunds.reduce((sum, r) => sum + r.amount_cents, 0)

    const startedAt = session.started_at
    const endedAt = session.ended_at ?? new Date().toISOString()
    const durationMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
    )
    const tables = session.tables as unknown as { name: string } | null

    const isTab = session.table_id === null

    return NextResponse.json({
      venueName: venue?.name ?? "Venue",
      receiptFooter: venue?.receipt_footer ?? "",
      currency: venue?.currency ?? "CAD",
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
      // Refund surface: history + running totals, plus whether the viewer may
      // issue a reversal (owner/manager). netPaidCents = collected − refunded.
      paymentStatus: payment.status,
      refunds,
      refundedTotalCents,
      netPaidCents: payment.grand_total_cents - refundedTotalCents,
      canRefund: role === "owner" || role === "manager",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("Receipt generation failed:", msg, e)
    if (msg === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error", detail: msg }, { status: 500 })
  }
}
