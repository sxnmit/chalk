import crypto from "crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { absoluteUrl, apiError, HttpError, requireRole } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["owner", "manager", "staff"]).default("staff"),
})

// Sends the invite email via Supabase and returns the id of the passwordless
// auth user it creates for the recipient. We deliberately do NOT rely on the
// magic-link session inside that email (enterprise mail scanners consume the
// single-use token before the human clicks). Instead the link just carries our
// own venue_invites token to /signup, where the invitee sets a password and the
// claim endpoint attaches it to this pre-created user.
async function sendInviteEmail(email: string, token: string): Promise<string> {
  const provider = process.env.INVITE_EMAIL_PROVIDER
  if (provider !== "supabase") {
    throw new HttpError(
      501,
      "Invite email provider is not configured. Set INVITE_EMAIL_PROVIDER=supabase or choose Resend/Postmark before enabling invites."
    )
  }

  const admin = createAdminClient()
  const redirectTo = absoluteUrl(`/signup?token=${encodeURIComponent(token)}`)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) {
    if ((error as { code?: string }).code === "email_exists") {
      throw new HttpError(409, "This person already has an account and can't be invited this way.")
    }
    throw error
  }
  if (!data.user) {
    throw new HttpError(500, "Invite provider did not return a user")
  }
  return data.user.id
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["owner"])
    const body = await request.json()
    const parsed = InviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { email, role } = parsed.data

    const admin = createAdminClient()

    const { data: existingInvite, error: existingInviteError } = await admin
      .from("venue_invites")
      .select("id, token, invited_user_id")
      .eq("venue_id", profile.venueId)
      .eq("email", email)
      .is("accepted_at", null)
      .maybeSingle()
    if (existingInviteError) throw existingInviteError

    // Reuse the existing token on resend rather than rotating it — the old
    // token was already emailed to the recipient, so keeping it valid means
    // a failed resend never orphans a previously-working invite link.
    const token = existingInvite?.token ?? crypto.randomBytes(32).toString("base64url")

    const upsert = existingInvite
      ? admin
          .from("venue_invites")
          .update({
            role,
            invited_by: profile.userId,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", existingInvite.id)
          .select("id, email, role, created_at, expires_at")
          .single()
      : admin
          .from("venue_invites")
          .insert({
            venue_id: profile.venueId,
            email,
            role,
            token,
            invited_by: profile.userId,
          })
          .select("id, email, role, created_at, expires_at")
          .single()

    const { data: invite, error } = await upsert
    if (error) throw error

    // On resend, remove the passwordless shell created by the prior invite —
    // inviteUserByEmail refuses to email an address that already has an account,
    // so we can't resend without clearing it first. Safe because the shell is
    // unclaimed (this is a still-pending invite).
    if (existingInvite?.invited_user_id) {
      await admin.auth.admin.deleteUser(existingInvite.invited_user_id).catch(() => {})
    }

    try {
      const invitedUserId = await sendInviteEmail(email, token)
      await admin
        .from("venue_invites")
        .update({ invited_user_id: invitedUserId })
        .eq("id", invite.id)
    } catch (sendError) {
      // Only roll back a freshly created invite — an existing pending invite
      // predates this request, so leave it (with its original token still
      // valid) rather than destroying it on a failed resend.
      if (!existingInvite) {
        await admin.from("venue_invites").delete().eq("id", invite.id)
      }
      throw sendError
    }

    return NextResponse.json({ invite })
  } catch (error) {
    return apiError(error)
  }
}
