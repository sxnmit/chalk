import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"

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

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    let cardLast4: string | null = null
    if (payment.stripe_payment_intent_id && payment.method === "card") {
      try {
        const stripe = getStripe()
        const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
          expand: ["latest_charge.payment_method_details"],
        })
        const charge = pi.latest_charge as Stripe.Charge | null
        cardLast4 = charge?.payment_method_details?.card?.last4 ?? null
      } catch {}
    }

    const startedAt = session.started_at
    const endedAt = session.ended_at ?? new Date().toISOString()
    const durationMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000
    )
    const tables = session.tables as unknown as { name: string } | null
    const venues = session.venues as unknown as { name: string } | null

    return NextResponse.json({
      venueName: venues?.name ?? "Venue",
      receiptNumber: paymentId.slice(-8).toUpperCase(),
      createdAt: payment.created_at,
      tableName: tables?.name ?? "Table",
      startedAt,
      endedAt,
      durationMinutes,
      actualRateCharged: Number(session.actual_rate_charged),
      orderItems: (orderItems ?? []).map((item) => ({
        name: (item.menu_items as unknown as { name: string } | null)?.name ?? "Item",
        quantity: item.quantity,
        price_at_time_cents: item.price_at_time_cents,
        line_total_cents: item.quantity * item.price_at_time_cents,
      })),
      tableTotalCents: payment.table_total_cents,
      itemsTotalCents: payment.items_total_cents,
      taxCents: payment.tax_cents,
      grandTotalCents: payment.grand_total_cents,
      method: payment.method,
      cardLast4,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}
