import { NextResponse } from "next/server"
import { apiError, requireRole } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { profile } = await requireRole(["owner"])
    const { inviteId } = await params
    const admin = createAdminClient()

    const { error } = await admin
      .from("venue_invites")
      .delete()
      .eq("id", inviteId)
      .eq("venue_id", profile.venueId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
