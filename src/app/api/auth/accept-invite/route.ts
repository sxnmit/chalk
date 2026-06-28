import { NextResponse } from "next/server"
import { apiError, requireProfile } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

export async function POST(request: Request) {
  try {
    const { profile } = await requireProfile({ allowMissingVenue: true })
    const body = await request.json()
    const token = String(body.token ?? "")
    if (!token) return NextResponse.json({ error: "Invite token is required" }, { status: 400 })

    const admin = createAdminClient()
    const { data: invite, error: inviteError } = await admin
      .from("venue_invites")
      .select("id, venue_id, email, role, accepted_at, expires_at")
      .eq("token", token)
      .maybeSingle()

    if (inviteError) throw inviteError
    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 })
    }

    if (profile.email && invite.email.toLowerCase() !== profile.email.toLowerCase()) {
      return NextResponse.json({ error: "This invite belongs to a different email" }, { status: 403 })
    }

    const [{ error: memberError }, { error: inviteUpdateError }, { error: userError }] = await Promise.all([
      admin.from("venue_members").upsert({
        venue_id: invite.venue_id,
        user_id: profile.userId,
        role: invite.role,
      }),
      admin
        .from("venue_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id),
      admin.from("users").upsert({
        id: profile.userId,
        venue_id: invite.venue_id,
        name: profile.email ?? invite.email,
        role: invite.role,
      }),
    ])

    if (memberError) throw memberError
    if (inviteUpdateError) throw inviteUpdateError
    if (userError) throw userError

    return NextResponse.json({ ok: true, venueId: invite.venue_id })
  } catch (error) {
    return apiError(error)
  }
}
