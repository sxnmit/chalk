import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { apiError, requireProfile } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function POST(request: Request) {
  try {
    const { profile } = await requireProfile({ allowMissingVenue: true })
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const timezone = String(body.timezone ?? "America/Toronto").trim()

    if (!name) {
      return NextResponse.json({ error: "Venue name is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: venue, error: venueError } = await admin
      .from("venues")
      .insert({ name, timezone })
      .select("id, name")
      .single()
    if (venueError) throw venueError

    const customer = await getStripe().customers.create({
      email: profile.email,
      name,
      metadata: { venue_id: venue.id },
      address: {
        line1: body.addressLine1 || undefined,
        city: body.city || undefined,
        postal_code: body.postalCode || undefined,
        country: body.country || "CA",
      },
    })

    const price = process.env.STRIPE_PRICE_ID_CHALK_MONTHLY
    let stripeSubscriptionId: string | null = null
    let stripePriceId: string | null = price ?? null
    let trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    let currentPeriodEnd: string | null = null

    if (price) {
      const stripeSubscription = await getStripe().subscriptions.create({
        customer: customer.id,
        items: [{ price }],
        trial_period_days: 14,
        metadata: { venue_id: venue.id },
      })
      stripeSubscriptionId = stripeSubscription.id
      stripePriceId = stripeSubscription.items.data[0]?.price.id ?? price
      trialEndsAt = stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000).toISOString()
        : trialEndsAt
      const periodEndTs = stripeSubscription.billing_schedules?.[0]?.bill_until?.computed_timestamp
      currentPeriodEnd = periodEndTs
        ? new Date(periodEndTs * 1000).toISOString()
        : null
    }

    const [{ error: venueUpdateError }, { error: memberError }, { error: legacyUserError }, { error: subError }] =
      await Promise.all([
        admin.from("venues").update({ stripe_customer_id: customer.id }).eq("id", venue.id),
        admin.from("venue_members").insert({
          venue_id: venue.id,
          user_id: profile.userId,
          role: "owner",
        }),
        admin.from("users").upsert({
          id: profile.userId,
          venue_id: venue.id,
          name: profile.email ?? "Owner",
          role: "owner",
        }),
        admin.from("subscriptions").insert({
          venue_id: venue.id,
          stripe_customer_id: customer.id,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: stripePriceId,
          status: "trialing",
          trial_ends_at: trialEndsAt,
          current_period_end: currentPeriodEnd,
        }),
      ])

    if (venueUpdateError) throw venueUpdateError
    if (memberError) throw memberError
    if (legacyUserError) throw legacyUserError
    if (subError) throw subError

    return NextResponse.json({ venueId: venue.id })
  } catch (error) {
    return apiError(error)
  }
}
