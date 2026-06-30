import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { TablesAdminClient } from "./_client"

export default async function AdminTablesPage() {
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

  return <TablesAdminClient venueName={venue?.name ?? "Venue"} isOwner={profile.role === "owner"} />
}
