import { redirect } from "next/navigation"
import { getProfile } from "@/lib/auth"
import { RevenuePageClient } from "./_client"

export default async function RevenuePage() {
  let role: string
  try {
    role = (await getProfile()).role
  } catch {
    redirect("/login")
  }

  if (role !== "owner") redirect("/dashboard")

  return <RevenuePageClient />
}
