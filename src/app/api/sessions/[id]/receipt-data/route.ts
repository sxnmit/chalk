import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const piId = request.nextUrl.searchParams.get("pi")
    if (!piId) return NextResponse.json({ last4: null })

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
