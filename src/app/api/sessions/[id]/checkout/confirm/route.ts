import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { getStripe } from "@/lib/stripe"

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
    const elapsedHours = (now.getTime() - new Date(session.started_at).getTime()) / (1000 * 60 * 60)
    const tableTotalCents = Math.round(Number(session.actual_rate_charged) * 100 * elapsedHours)

    const { data: items } = await supabase
      .from("order_items")
      .select("quantity, price_at_time_cents")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)

    const itemsTotalCents = (items ?? []).reduce((sum, i) => sum + i.quantity * i.price_at_time_cents, 0)
    const grandTotalCents = tableTotalCents + itemsTotalCents

    if (parsed.data.method === "card") {
      const piId = parsed.data.payment_intent_id
      if (!piId) return NextResponse.json({ error: "payment_intent_id required for card" }, { status: 400 })

      const stripe = getStripe()
      const pi = await stripe.paymentIntents.retrieve(piId)
      if (pi.status !== "succeeded") {
        return NextResponse.json({ error: `Payment not succeeded (status: ${pi.status})` }, { status: 400 })
      }

      // Upsert payment record
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("session_id", sessionId)
        .eq("venue_id", venueId)
        .maybeSingle()

      let paymentId: string
      if (existing) {
        const { data } = await supabase
          .from("payments")
          .update({
            method: "card",
            table_total_cents: tableTotalCents,
            items_total_cents: itemsTotalCents,
            grand_total_cents: grandTotalCents,
            stripe_payment_intent_id: piId,
            status: "succeeded",
          })
          .eq("id", existing.id)
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
            stripe_payment_intent_id: piId,
            status: "succeeded",
          })
          .select("id")
          .single()
        paymentId = data!.id
      }

      await closeSession(supabase, sessionId, now)
      return NextResponse.json({ ok: true, payment_id: paymentId })
    }

    // Cash flow
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .maybeSingle()

    let paymentId: string
    if (existing) {
      const { data } = await supabase
        .from("payments")
        .update({
          method: "cash",
          table_total_cents: tableTotalCents,
          items_total_cents: itemsTotalCents,
          grand_total_cents: grandTotalCents,
          status: "succeeded",
        })
        .eq("id", existing.id)
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
          tax_cents: 0,
          tip_cents: 0,
          grand_total_cents: grandTotalCents,
          status: "succeeded",
        })
        .select("id")
        .single()
      paymentId = data!.id
    }

    await closeSession(supabase, sessionId, now)
    return NextResponse.json({ ok: true, payment_id: paymentId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 401 })
  }
}

async function closeSession(
  supabase: Awaited<ReturnType<typeof import("@/utils/supabase/server").createClient>>,
  sessionId: string,
  now: Date
) {
  const { data: session } = await supabase
    .from("sessions")
    .select("table_id")
    .eq("id", sessionId)
    .single()

  await Promise.all([
    supabase
      .from("sessions")
      .update({ ended_at: now.toISOString() })
      .eq("id", sessionId),
    session?.table_id
      ? supabase.from("tables").update({ status: "free" }).eq("id", session.table_id)
      : Promise.resolve(),
  ])
}
