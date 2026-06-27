import { NextResponse } from "next/server"
import { apiError, requireRole } from "@/lib/billing/server"
import type { VenueRole } from "@/lib/billing/types"
import { createAdminClient } from "@/utils/supabase/admin"

function parseRole(role: unknown): VenueRole | null {
  if (role === "owner" || role === "manager" || role === "staff") return role
  return null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { profile } = await requireRole(["owner"])
    const { memberId } = await params
    const body = await request.json()
    const role = parseRole(body.role)

    if (!role) return NextResponse.json({ error: "Invalid role" }, { status: 400 })

    const admin = createAdminClient()
    const { data: member, error: lookupError } = await admin
      .from("venue_members")
      .select("id, user_id")
      .eq("id", memberId)
      .eq("venue_id", profile.venueId)
      .single()
    if (lookupError) throw lookupError

    if (member.user_id === profile.userId && role !== "owner") {
      return NextResponse.json({ error: "You cannot remove your own owner role" }, { status: 400 })
    }

    const { error } = await admin
      .from("venue_members")
      .update({ role })
      .eq("id", memberId)
      .eq("venue_id", profile.venueId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
