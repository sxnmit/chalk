import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import type { RequestProfile, SubscriptionSummary, VenueRole } from "@/lib/billing/types"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function decodeClaims(accessToken: string) {
  return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString()) as {
    app_metadata?: {
      venue_id?: string
      active_venue_id?: string
      role?: string
    }
  }
}

function isVenueRole(role: string | undefined): role is VenueRole {
  return role === "owner" || role === "manager" || role === "staff"
}

export async function getRequestProfile(
  supabase: ServerClient,
  options: { allowMissingVenue?: boolean } = {}
): Promise<RequestProfile | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  const {
    data: { session },
  } = await supabase.auth.getSession()

  let claimVenueId: string | undefined
  let claimRole: string | undefined

  if (session?.access_token) {
    const claims = decodeClaims(session.access_token)
    claimVenueId = claims.app_metadata?.active_venue_id ?? claims.app_metadata?.venue_id
    claimRole = claims.app_metadata?.role
  }

  if (claimVenueId && isVenueRole(claimRole)) {
    return {
      userId: user.id,
      email: user.email ?? undefined,
      venueId: claimVenueId,
      role: claimRole,
    }
  }

  const { data: membership } = await supabase
    .from("venue_members")
    .select("venue_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membership && isVenueRole(membership.role)) {
    return {
      userId: user.id,
      email: user.email ?? undefined,
      venueId: membership.venue_id,
      role: membership.role,
    }
  }

  const { data: legacyUser } = await supabase
    .from("users")
    .select("venue_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (legacyUser && isVenueRole(legacyUser.role)) {
    return {
      userId: user.id,
      email: user.email ?? undefined,
      venueId: legacyUser.venue_id,
      role: legacyUser.role,
    }
  }

  if (options.allowMissingVenue) {
    return {
      userId: user.id,
      email: user.email ?? undefined,
      venueId: "",
      role: "staff",
    }
  }

  return null
}

export async function requireProfile(
  options: { allowMissingVenue?: boolean } = {}
): Promise<{ supabase: ServerClient; profile: RequestProfile }> {
  const supabase = await createClient()
  const profile = await getRequestProfile(supabase, options)

  if (!profile) throw new HttpError(401, "Authentication required")
  if (!options.allowMissingVenue && !profile.venueId) {
    throw new HttpError(403, "No active venue")
  }

  return { supabase, profile }
}

export async function requireRole(roles: VenueRole[]) {
  const ctx = await requireProfile()
  if (!roles.includes(ctx.profile.role)) {
    throw new HttpError(403, "Insufficient permissions")
  }
  return ctx
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

export async function loadSubscriptionSummary(venueId: string): Promise<SubscriptionSummary> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "venue_id, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, cancel_at_period_end"
    )
    .eq("venue_id", venueId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    const { data: venue, error: venueError } = await admin
      .from("venues")
      .select("stripe_customer_id")
      .eq("id", venueId)
      .maybeSingle()
    if (venueError) throw venueError

    return {
      venueId,
      status: "none",
      stripeCustomerId: venue?.stripe_customer_id ?? null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }
  }

  return {
    venueId: data.venue_id,
    status: data.status,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    stripePriceId: data.stripe_price_id,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
  }
}

export function absoluteUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000"

  const normalizedBase = base.startsWith("http") ? base : `https://${base}`
  return new URL(path, normalizedBase).toString()
}
