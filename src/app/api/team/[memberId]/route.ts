import { NextResponse } from "next/server"
import { apiError, requireRole } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { profile } = await requireRole(["owner"])
    const { memberId } = await params
    const admin = createAdminClient()

    const { data: member, error: lookupError } = await admin
      .from("venue_members")
      .select("id, user_id")
      .eq("id", memberId)
      .eq("venue_id", profile.venueId)
      .single()
    if (lookupError) throw lookupError

    if (member.user_id === profile.userId) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 })
    }

    const { error } = await admin
      .from("venue_members")
      .delete()
      .eq("id", memberId)
      .eq("venue_id", profile.venueId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
