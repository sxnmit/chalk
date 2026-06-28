import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { absoluteUrl, apiError, loadSubscriptionSummary, requireProfile } from "@/lib/billing/server"

export async function POST() {
  try {
    const { profile } = await requireProfile()
    const subscription = await loadSubscriptionSummary(profile.venueId)

    if (!subscription.stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer exists for this venue" }, { status: 409 })
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: absoluteUrl("/admin/billing"),
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return apiError(error)
  }
}
