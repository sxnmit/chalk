import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { sessionTableTotalCents } from "@/lib/billing-table"
import { getVenueTaxRate, computeTaxCents } from "@/lib/tax"

const ConfirmSchema = z.object({
  method: z.enum(["cash"]),
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
    const body = await request.json()
    const parsed = ConfirmSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

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
    const tipCents = parsed.data.tip_cents
    const grandTotalCents = subtotalCents + taxCents + tipCents

    const { data: existing } = await supabase
      .from("payments")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .neq("status", "succeeded")
      .maybeSingle()

    let paymentId: string
    if (existing) {
      const { data, error } = await supabase
        .from("payments")
        .update({
          method: "cash",
          table_total_cents: tableTotalCents,
          items_total_cents: itemsTotalCents,
          tax_cents: taxCents,
          tip_cents: tipCents,
          grand_total_cents: grandTotalCents,
          stripe_payment_intent_id: null,
          status: "succeeded",
        })
        .eq("id", existing.id)
        .eq("venue_id", venueId)
        .select("id")
        .single()
      if (error || !data) return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
      paymentId = data.id
    } else {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          venue_id: venueId,
          session_id: sessionId,
          method: "cash",
          table_total_cents: tableTotalCents,
          items_total_cents: itemsTotalCents,
          tax_cents: taxCents,
          tip_cents: tipCents,
          grand_total_cents: grandTotalCents,
          status: "succeeded",
        })
        .select("id")
        .single()
      if (error || !data) return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
      paymentId = data.id
    }

    await closeSession(supabase, venueId, sessionId, now)
    return NextResponse.json({ ok: true, payment_id: paymentId })
  } catch (e) {
    const isAuthError = e instanceof Error && (e.message === "Not authenticated" || e.message.includes("no venue"))
    return NextResponse.json(
      { error: isAuthError ? "Unauthorized" : "Internal server error" },
      { status: isAuthError ? 401 : 500 },
    )
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
