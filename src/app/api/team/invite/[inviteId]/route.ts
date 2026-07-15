import { NextResponse } from "next/server"
import { apiError, HttpError, requireRole } from "@/lib/billing/server"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { supabase, profile } = await requireRole(["owner"])
    const { inviteId } = await params

    const { data: invite, error: lookupError } = await supabase
      .from("venue_invites")
      .select("id, email, role, created_at, expires_at")
      .eq("id", inviteId)
      .eq("venue_id", profile.venueId)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!invite) throw new HttpError(404, "Invite not found")

    // Auditing happens in the database: the audit_venue_invites trigger
    // records this delete (with the full before row) atomically, attributed
    // to this owner since the delete runs through their own JWT-scoped
    // client (the "owners manage invites" RLS policy already permits it).
    const { error } = await supabase
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
