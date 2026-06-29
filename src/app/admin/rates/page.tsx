import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { RatesAdminClient } from "./_client"

export default async function AdminRatesPage() {
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
    .select("name")
    .eq("id", profile.venueId)
    .single()

  return <RatesAdminClient venueName={venue?.name ?? "Venue"} isOwner={profile.role === "owner"} />
}
