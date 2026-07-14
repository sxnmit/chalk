import { NextResponse } from "next/server"
import { apiError, HttpError, requireRole } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { profile } = await requireRole(["owner"])
    const { inviteId } = await params
    const admin = createAdminClient()

    const { data: invite, error: lookupError } = await admin
      .from("venue_invites")
      .select("id, email, role, created_at, expires_at")
      .eq("id", inviteId)
      .eq("venue_id", profile.venueId)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!invite) throw new HttpError(404, "Invite not found")

    // Auditing happens in the database: the audit_venue_invites trigger
    // records this delete (with the full before row) atomically. Note the
    // delete runs through the admin client, so the trigger's auth.uid() is
    // null and the row is attributed to "System" rather than this owner.
    const { error } = await admin
      .from("venue_invites")
      .delete()
      .eq("id", invite.id)
      .eq("venue_id", profile.venueId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
