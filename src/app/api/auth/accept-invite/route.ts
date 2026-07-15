import { NextResponse } from "next/server"
import { z } from "zod"
import { apiError, requireProfile } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

const AcceptInviteSchema = z.object({
  token: z.string().trim().min(1, "Invite token is required"),
})

export async function POST(request: Request) {
  try {
    const { profile } = await requireProfile({ allowMissingVenue: true })
    const body = await request.json()
    const parsed = AcceptInviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { token } = parsed.data

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
