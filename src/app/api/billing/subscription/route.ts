import { NextResponse } from "next/server"
import { apiError, loadSubscriptionSummary, requireProfile } from "@/lib/billing/server"

export async function GET() {
  try {
    const { profile } = await requireProfile()
    const subscription = await loadSubscriptionSummary(profile.venueId)
    return NextResponse.json({ subscription, role: profile.role })
  } catch (error) {
    return apiError(error)
  }
}
