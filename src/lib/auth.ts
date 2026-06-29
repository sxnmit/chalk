"use server"

import { createClient } from "@/utils/supabase/server"

export interface UserProfile {
  venueId: string
  role: string
  userId: string
}

export async function getProfile(): Promise<UserProfile> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error("Not authenticated")

  const { data: { session } } = await supabase.auth.getSession()

  let venueId: string | undefined
  let role: string | undefined

  if (session?.access_token) {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64url").toString()
    )
    venueId = payload.app_metadata?.venue_id as string | undefined
    role = payload.app_metadata?.role as string | undefined
  }

  if (!venueId) {
    const { data: member } = await supabase
      .from("venue_members")
      .select("venue_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (member) {
      venueId = member.venue_id
      role = member.role
    } else {
      const { data: dbUser } = await supabase
        .from("users")
        .select("venue_id, role")
        .eq("id", user.id)
        .maybeSingle()

      if (dbUser) {
        venueId = dbUser.venue_id
        role = dbUser.role
      }
    }
  }

  if (!venueId) throw new Error("User has no venue — ensure onboarding is complete")

  return { venueId, role: role ?? "staff", userId: user.id }
}
