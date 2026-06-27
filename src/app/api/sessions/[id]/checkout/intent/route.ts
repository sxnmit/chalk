import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId } = await params
    const stripe = getStripe()

    // Validate session
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, venue_id, started_at, actual_rate_charged")
      .eq("id", sessionId)
      .eq("venue_id", venueId)
      .is("ended_at", null)
      .single()

    if (sessionErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    // Compute totals
    const now = new Date()
    const elapsedHours = (now.getTime() - new Date(session.started_at).getTime()) / (1000 * 60 * 60)
    const tableTotalCents = Math.round(Number(session.actual_rate_charged) * 100 * elapsedHours)

    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, price_at_time_cents")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)

    const itemsTotalCents = (items ?? []).reduce((sum, i) => sum + i.quantity * i.price_at_time_cents, 0)
    const grandTotalCents = tableTotalCents + itemsTotalCents

    // Check for existing pending payment
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, stripe_payment_intent_id, status")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .maybeSingle()

    if (existingPayment?.stripe_payment_intent_id && existingPayment.status === "pending") {
      // Try to reuse existing PaymentIntent
      try {
        const pi = await stripe.paymentIntents.retrieve(existingPayment.stripe_payment_intent_id)
        if (pi.status === "requires_payment_method" || pi.status === "requires_confirmation") {
          return NextResponse.json({ client_secret: pi.client_secret, payment_id: existingPayment.id })
        }
      } catch {}
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.max(grandTotalCents, 50), // Stripe minimum 50 cents
        currency: "cad",
        metadata: { session_id: sessionId, venue_id: venueId },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: `session-${sessionId}-checkout` }
    )

    // Upsert payment row
    let paymentId: string
    if (existingPayment) {
      const { data } = await supabase
        .from("payments")
        .update({
          method: "card",
          table_total_cents: tableTotalCents,
          items_total_cents: itemsTotalCents,
          grand_total_cents: grandTotalCents,
          stripe_payment_intent_id: paymentIntent.id,
          status: "pending",
        })
        .eq("id", existingPayment.id)
        .select("id")
        .single()
      paymentId = data!.id
    } else {
      const { data } = await supabase
        .from("payments")
        .insert({
          venue_id: venueId,
          session_id: sessionId,
          method: "card",
          table_total_cents: tableTotalCents,
          items_total_cents: itemsTotalCents,
          tax_cents: 0,
          tip_cents: 0,
          grand_total_cents: grandTotalCents,
          stripe_payment_intent_id: paymentIntent.id,
          status: "pending",
        })
        .select("id")
        .single()
      paymentId = data!.id
    }

    return NextResponse.json({ client_secret: paymentIntent.client_secret, payment_id: paymentId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: e instanceof Error && msg === "Unauthorized" ? 401 : 500 })
  }
}
