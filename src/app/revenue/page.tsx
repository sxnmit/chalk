import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { RevenuePageClient } from "./_client"

export default async function RevenuePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "owner") redirect("/dashboard")

  return <RevenuePageClient />
}
