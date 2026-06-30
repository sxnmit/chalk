import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"
import { sessionTableTotalCents } from "@/lib/billing-table"
import { getVenueTaxRate, computeTaxCents } from "@/lib/tax"

const ConfirmSchema = z.object({
  method: z.enum(["card", "cash"]),
  payment_intent_id: z.string().optional(), // required for card
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId } = await params
    const body = await request.json()
    const parsed = ConfirmSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Validate session belongs to venue and is still active
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, venue_id, started_at, actual_rate_charged")
      .eq("id", sessionId)
      .eq("venue_id", venueId)
      .is("ended_at", null)
      .single()

    if (sessionErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

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
    const grandTotalCents = subtotalCents + taxCents
    const stripeAmountCents = Math.max(grandTotalCents, 50)

    if (parsed.data.method === "card") {
      const piId = parsed.data.payment_intent_id
      if (!piId) return NextResponse.json({ error: "payment_intent_id required for card" }, { status: 400 })

      const { data: existing } = await supabase
        .from("payments")
        .select("id, stripe_payment_intent_id, tax_cents")
        .eq("session_id", sessionId)
        .eq("venue_id", venueId)
        .eq("stripe_payment_intent_id", piId)
        .maybeSingle()

      if (!existing) {
        return NextResponse.json({ error: "Payment intent does not belong to this session" }, { status: 400 })
      }

      const stripe = getStripe()
      const pi = await stripe.paymentIntents.retrieve(piId)
      if (pi.status !== "succeeded") {
        return NextResponse.json({ error: "Payment has not been completed" }, { status: 400 })
      }

      // Compare against the amount the PI was authorized for (snapshotted at
      // intent time), not the recomputed total — elapsed time between intent
      // and confirm would otherwise reject every valid card payment.
      if (
        pi.currency !== "cad" ||
        pi.metadata.session_id !== sessionId ||
        pi.metadata.venue_id !== venueId ||
        pi.amount_received < pi.amount
      ) {
        return NextResponse.json({ error: "Payment intent does not match this checkout" }, { status: 400 })
      }

      const billedGrandTotalCents = pi.amount_received
      const billedTaxCents = existing.tax_cents ?? 0
      const billedTableTotalCents = Math.max(0, billedGrandTotalCents - itemsTotalCents - billedTaxCents)

      const { data, error } = await supabase
        .from("payments")
        .update({
          method: "card",
          table_total_cents: billedTableTotalCents,
          items_total_cents: itemsTotalCents,
          tax_cents: billedTaxCents,
          grand_total_cents: billedGrandTotalCents,
          stripe_payment_intent_id: piId,
          status: "succeeded",
        })
        .eq("id", existing.id)
        .eq("venue_id", venueId)
        .select("id")
        .single()

      if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })

      await closeSession(supabase, venueId, sessionId, now)
      return NextResponse.json({ ok: true, payment_id: data.id })
    }

    // Cash flow — only reuse a row that hasn't already been bound to a Stripe
    // PaymentIntent. Otherwise a prior card attempt's pending row would be
    // silently relabeled as a successful cash payment.
    const { data: existing } = await supabase
      .from("payments")
      .select("id, stripe_payment_intent_id, status")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .is("stripe_payment_intent_id", null)
      .neq("status", "succeeded")
      .maybeSingle()

    let paymentId: string
    if (existing) {
      const { data } = await supabase
        .from("payments")
        .update({
          method: "cash",
          table_total_cents: tableTotalCents,
          items_total_cents: itemsTotalCents,
          tax_cents: taxCents,
          grand_total_cents: grandTotalCents,
          status: "succeeded",
        })
        .eq("id", existing.id)
        .eq("venue_id", venueId)
        .select("id")
        .single()
      paymentId = data!.id
    } else {
      const { data } = await supabase
        .from("payments")
        .insert({
          venue_id: venueId,
          session_id: sessionId,
          method: "cash",
          table_total_cents: tableTotalCents,
          items_total_cents: itemsTotalCents,
          tax_cents: taxCents,
          tip_cents: 0,
          grand_total_cents: grandTotalCents,
          status: "succeeded",
        })
        .select("id")
        .single()
      paymentId = data!.id
    }

    await closeSession(supabase, venueId, sessionId, now)
    return NextResponse.json({ ok: true, payment_id: paymentId })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

async function closeSession(
  supabase: Awaited<ReturnType<typeof import("@/utils/supabase/server").createClient>>,
  venueId: string,
  sessionId: string,
  now: Date
) {
  const { data: session } = await supabase
    .from("sessions")
    .select("table_id")
    .eq("id", sessionId)
    .eq("venue_id", venueId)
    .single()

  await Promise.all([
    supabase
      .from("sessions")
      .update({ ended_at: now.toISOString() })
      .eq("id", sessionId)
      .eq("venue_id", venueId)
      .is("ended_at", null),
    session?.table_id
      ? supabase.from("tables").update({ status: "free" }).eq("id", session.table_id).eq("venue_id", venueId)
      : Promise.resolve(),
  ])
}
