import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { absoluteUrl, apiError, loadSubscriptionSummary, requireRole } from "@/lib/billing/server"

export async function POST() {
  try {
    const { profile } = await requireRole(["owner"])
    const price = process.env.STRIPE_PRICE_ID_CHALK_MONTHLY
    if (!price) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const subscription = await loadSubscriptionSummary(profile.venueId)
    if (!subscription.stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer exists for this venue" }, { status: 409 })
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: subscription.stripeCustomerId,
      line_items: [{ price, quantity: 1 }],
      success_url: absoluteUrl("/admin/billing?checkout=success"),
      cancel_url: absoluteUrl("/admin/billing?checkout=canceled"),
      subscription_data: {
        metadata: { venue_id: profile.venueId },
      },
      metadata: { venue_id: profile.venueId },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return apiError(error)
  }
}
