import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { ShipmentsAdminClient } from "./_client"

export default async function AdminShipmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let profile
  try {
    profile = await getProfile()
  } catch {
    redirect("/login")
  }

  if (profile.role !== "owner" && profile.role !== "manager") redirect("/dashboard")

  const { data: venue } = await supabase
    .from("venues")
    .select("name, timezone")
    .eq("id", profile.venueId)
    .single()

  return (
    <ShipmentsAdminClient
      venueName={venue?.name ?? "Venue"}
      venueTimezone={venue?.timezone ?? "UTC"}
      isOwner={profile.role === "owner"}
    />
  )
}
