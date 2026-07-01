import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"
import { sessionTableTotalCents } from "@/lib/billing-table"
import { getVenueTaxRate, computeTaxCents } from "@/lib/tax"

const IntentSchema = z.object({
  tip_cents: z.number().int().min(0).max(999999).default(0),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId } = await params
    const stripe = getStripe()

    let tipCents = 0
    try {
      const body = await request.json()
      const parsed = IntentSchema.safeParse(body)
      if (parsed.success) tipCents = parsed.data.tip_cents
    } catch {
      // No body or invalid JSON — default to 0 tip
    }

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
    const tableTotalCents = await sessionTableTotalCents(
      supabase, venueId, session.started_at, Number(session.actual_rate_charged), now.getTime(),
    )

    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, price_at_time_cents")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)

    const itemsTotalCents = (items ?? []).reduce((sum, i) => sum + i.quantity * i.price_at_time_cents, 0)
    const taxRate = await getVenueTaxRate(supabase, venueId)
    const subtotalCents = tableTotalCents + itemsTotalCents
    const taxCents = computeTaxCents(subtotalCents, taxRate)
    const grandTotalCents = subtotalCents + taxCents + tipCents
    const stripeAmountCents = Math.max(grandTotalCents, 50)

    // Check for existing pending payment
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, stripe_payment_intent_id, status")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .maybeSingle()

    if (existingPayment?.stripe_payment_intent_id && existingPayment.status === "pending") {
      try {
        const pi = await stripe.paymentIntents.retrieve(existingPayment.stripe_payment_intent_id)
        if (pi.status === "requires_payment_method" || pi.status === "requires_confirmation") {
          const updatedIntent = await stripe.paymentIntents.update(pi.id, {
            amount: stripeAmountCents,
            metadata: {
              session_id: sessionId,
              venue_id: venueId,
              expected_grand_total_cents: String(grandTotalCents),
            },
          })

          const { error: updateErr } = await supabase
            .from("payments")
            .update({
              method: "card",
              table_total_cents: tableTotalCents,
              items_total_cents: itemsTotalCents,
              tax_cents: taxCents,
              tip_cents: tipCents,
              grand_total_cents: grandTotalCents,
              stripe_payment_intent_id: updatedIntent.id,
              status: "pending",
            })
            .eq("id", existingPayment.id)
            .eq("venue_id", venueId)

          if (updateErr) return NextResponse.json({ error: "Internal server error" }, { status: 500 })

          return NextResponse.json({ client_secret: updatedIntent.client_secret, payment_id: existingPayment.id })
        }
      } catch {}
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: stripeAmountCents,
        currency: "cad",
        metadata: {
          session_id: sessionId,
          venue_id: venueId,
          expected_grand_total_cents: String(grandTotalCents),
        },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: `session-${sessionId}-checkout-${stripeAmountCents}` }
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
          tax_cents: taxCents,
          tip_cents: tipCents,
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
          tax_cents: taxCents,
          tip_cents: tipCents,
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
    console.error("Checkout intent failed:", e)
    const isAuthError = e instanceof Error && e.message === "Not authenticated"
    return NextResponse.json(
      { error: isAuthError ? "Unauthorized" : "Internal server error" },
      { status: isAuthError ? 401 : 500 },
    )
  }
}
