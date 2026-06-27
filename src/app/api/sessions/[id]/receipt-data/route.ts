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
    const piId = request.nextUrl.searchParams.get("pi")
    if (!piId) return NextResponse.json({ last4: null })

    const { data: payment } = await supabase
      .from("payments")
      .select("id")
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .eq("stripe_payment_intent_id", piId)
      .eq("method", "card")
      .maybeSingle()

    if (!payment) return NextResponse.json({ last4: null }, { status: 404 })

    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ["latest_charge.payment_method_details"],
    })

    const charge = pi.latest_charge as Stripe.Charge | null
    const last4 = charge?.payment_method_details?.card?.last4 ?? null
    return NextResponse.json({ last4 })
  } catch {
    return NextResponse.json({ last4: null })
  }
}
