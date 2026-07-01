import crypto from "crypto"
import { NextResponse } from "next/server"
import { absoluteUrl, apiError, HttpError, requireRole } from "@/lib/billing/server"
import type { VenueRole } from "@/lib/billing/types"
import { createAdminClient } from "@/utils/supabase/admin"

function parseRole(role: unknown): VenueRole {
  if (role === "owner" || role === "manager" || role === "staff") return role
  return "staff"
}

async function sendInviteEmail(email: string, token: string) {
  const provider = process.env.INVITE_EMAIL_PROVIDER
  if (provider !== "supabase") {
    throw new HttpError(
      501,
      "Invite email provider is not configured. Set INVITE_EMAIL_PROVIDER=supabase or choose Resend/Postmark before enabling invites."
    )
  }

  const admin = createAdminClient()
  const redirectTo = absoluteUrl(`/accept-invite?token=${encodeURIComponent(token)}`)
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error) {
    if ((error as { code?: string }).code === "email_exists") {
      throw new HttpError(409, "This person already has an account and can't be invited this way.")
    }
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["owner"])
    const body = await request.json()
    const email = String(body.email ?? "").trim().toLowerCase()
    const role = parseRole(body.role)

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
    }

    const token = crypto.randomBytes(32).toString("base64url")
    const admin = createAdminClient()

    const { data: invite, error } = await admin
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
    if (error) throw error

    try {
      await sendInviteEmail(email, token)
    } catch (sendError) {
      await admin.from("venue_invites").delete().eq("id", invite.id)
      throw sendError
    }

    return NextResponse.json({ invite })
  } catch (error) {
    return apiError(error)
  }
}
