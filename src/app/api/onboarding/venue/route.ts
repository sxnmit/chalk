import { NextResponse } from "next/server"
import { z } from "zod"
import { getStripe } from "@/lib/stripe"
import { apiError, requireProfile } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

const validTimezones = new Set(Intl.supportedValuesOf("timeZone"))

const VenueSchema = z.object({
  name: z.string().trim().min(1, "Venue name is required").max(100),
  timezone: z
    .string()
    .trim()
    .default("America/Toronto")
    .refine((tz) => validTimezones.has(tz), "Invalid timezone"),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).default("CA"),
})

export async function POST(request: Request) {
  try {
    const { profile } = await requireProfile({ allowMissingVenue: true })

    if (profile.venueId) {
      return NextResponse.json(
        { error: "You already have a venue" },
        { status: 409 },
      )
    }

    const body = await request.json()
    const parsed = VenueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { name, timezone } = parsed.data

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
        line1: parsed.data.addressLine1 || undefined,
        city: parsed.data.city || undefined,
        postal_code: parsed.data.postalCode || undefined,
        country: parsed.data.country,
      },
    })

    const [{ error: venueUpdateError }, { error: memberError }, { error: legacyUserError }] =
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
      ])

    if (venueUpdateError) throw venueUpdateError
    if (memberError) throw memberError
    if (legacyUserError) throw legacyUserError

    return NextResponse.json({ venueId: venue.id })
  } catch (error) {
    return apiError(error)
  }
}
