"use server"

import { createClient } from "@/utils/supabase/server"

export interface UserProfile {
  venueId: string
  role: string
  userId: string
}

export async function getProfile(): Promise<UserProfile> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const payload = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString()
  )

  let venueId = payload.app_metadata?.venue_id as string | undefined
  let role = payload.app_metadata?.role as string | undefined

  // Fallback: JWT was issued before the hook update, or hook returned no claim.
  // Check venue_members first (onboarding signups), then legacy users table.
  if (!venueId) {
    const { data: member } = await supabase
      .from("venue_members")
      .select("venue_id, role")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (member) {
      venueId = member.venue_id
      role = member.role
    } else {
      const { data: user } = await supabase
        .from("users")
        .select("venue_id, role")
        .eq("id", session.user.id)
        .maybeSingle()

      if (user) {
        venueId = user.venue_id
        role = user.role
      }
    }
  }

  if (!venueId) throw new Error("User has no venue — ensure onboarding is complete")

  return { venueId, role: role ?? "staff", userId: session.user.id }
}
