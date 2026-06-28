import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/utils/supabase/admin"

export const runtime = "nodejs"

function toIso(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null
}

async function upsertSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminClient()
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id

  const venueId = subscription.metadata.venue_id
  const priceId = subscription.items.data[0]?.price.id ?? null

  let resolvedVenueId = venueId
  if (!resolvedVenueId) {
    const { data: venue, error: venueError } = await admin
      .from("venues")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle()
    if (venueError) throw venueError
    resolvedVenueId = venue?.id
  }

  if (!resolvedVenueId) {
    throw new Error(`Unable to resolve venue for Stripe customer ${customerId}`)
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      venue_id: resolvedVenueId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status: subscription.status,
      trial_ends_at: toIso(subscription.trial_end),
      current_period_end: toIso(subscription.billing_schedules?.[0]?.bill_until?.computed_timestamp ?? null),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id" }
  )
  if (error) throw error
}

async function isEventAlreadyProcessed(eventId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("processed_stripe_billing_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", eventId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

async function markEventProcessed(eventId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from("processed_stripe_billing_events")
    .insert({ stripe_event_id: eventId })

  // Ignore unique-violation: a concurrent retry already recorded the event.
  if (error && String(error.code) !== "23505") throw error
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET

  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 400 })
  }

  const rawBody = await request.text()
  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    if (await isEventAlreadyProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (typeof session.subscription === "string") {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription)
          await upsertSubscription(subscription)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await upsertSubscription(event.data.object as Stripe.Subscription)
        break
      case "invoice.payment_failed":
      case "invoice.payment_succeeded":
        break
      default:
        break
    }

    // Only record the event after the handler succeeds — otherwise Stripe's
    // retry would be deduped against a row inserted by a failed attempt and
    // the subscription state would stay stale forever.
    await markEventProcessed(event.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe billing webhook failed", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
