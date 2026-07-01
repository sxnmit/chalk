import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { absoluteUrl, apiError, requireRole } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function POST() {
  try {
    const { profile } = await requireRole(["owner"])
    const price = process.env.STRIPE_PRICE_ID_CHALK_MONTHLY
    if (!price) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const admin = createAdminClient()
    const { data: venue, error: venueError } = await admin
      .from("venues")
      .select("stripe_customer_id")
      .eq("id", profile.venueId)
      .single()
    if (venueError) throw venueError
    if (!venue?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing customer found" }, { status: 409 })
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: venue.stripe_customer_id,
      line_items: [{ price, quantity: 1 }],
      success_url: absoluteUrl("/onboarding?checkout=success"),
      cancel_url: absoluteUrl("/onboarding?checkout=canceled"),
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
