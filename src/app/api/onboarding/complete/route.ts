import { NextResponse } from "next/server"
import { apiError, requireRole } from "@/lib/billing/server"

export async function POST() {
  try {
    const { supabase, profile } = await requireRole(["owner"])
    const { error } = await supabase
      .from("venues")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", profile.venueId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
