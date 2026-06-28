"use server"

import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

export async function loadNavigationContext() {
  const supabase = await createClient()
  const profile = await getProfile()

  const { data: venue } = await supabase
    .from("venues")
    .select("name")
    .eq("id", profile.venueId)
    .single()

  return {
    venueName: venue?.name ?? "Venue",
    isOwner: profile.role === "owner" || profile.role === "manager",
  }
}
