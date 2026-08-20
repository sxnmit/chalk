import { NextResponse } from "next/server"
import { z } from "zod"
import { apiError } from "@/lib/billing/server"
import { createAdminClient } from "@/utils/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

const ClaimSchema = z.object({
  token: z.string().trim().min(1, "Invite token is required"),
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

// A valid invite is one that exists, hasn't been accepted, and hasn't expired.
async function loadValidInvite(admin: AdminClient, token: string) {
  const { data: invite, error } = await admin
    .from("venue_invites")
    .select("id, venue_id, email, role, accepted_at, expires_at, invited_user_id")
    .eq("token", token)
    .maybeSingle()
  if (error) throw error
  if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() < Date.now()) {
    return null
  }
  return invite
}

// Lets the signup form prefill/lock the email tied to an invite token.
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "Invite token is required" }, { status: 400 })
    }
    const admin = createAdminClient()
    const invite = await loadValidInvite(admin, token)
    if (!invite) {
      return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 })
    }
    return NextResponse.json({ email: invite.email })
  } catch (error) {
    return apiError(error)
  }
}

// Completes an invite: attaches the invitee's chosen password to the account
// (turning the passwordless invite shell into a normal email+password login)
// and joins them to the venue. Gated purely by the opaque invite token plus an
// email match — the token is a 32-byte secret that expires in 7 days, and the
// account being claimed is an empty shell, so this can't take over a real user.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ClaimSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { token, name, email, password } = parsed.data

    const admin = createAdminClient()
    const invite = await loadValidInvite(admin, token)
    if (!invite) {
      return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 })
    }
    if (invite.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "This invite is for a different email address." },
        { status: 403 }
      )
    }

    // Attach the password to the pre-created shell. Fall back to creating the
    // user if the shell went missing (e.g. cleaned up between invite and claim).
    let userId = invite.invited_user_id as string | null
    if (userId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { name },
      })
      if (updateError) {
        if ((updateError as { code?: string }).code === "user_not_found") {
          userId = null
        } else {
          throw updateError
        }
      }
    }
    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { name },
      })
      if (createError) {
        if ((createError as { code?: string }).code === "email_exists") {
          return NextResponse.json(
            { error: "An account with this email already exists. Please sign in instead." },
            { status: 409 }
          )
        }
        throw createError
      }
      userId = created.user.id
    }

    const [{ error: memberError }, { error: inviteUpdateError }, { error: userError }] =
      await Promise.all([
        admin.from("venue_members").upsert({
          venue_id: invite.venue_id,
          user_id: userId,
          role: invite.role,
        }),
        admin
          .from("venue_invites")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invite.id),
        admin.from("users").upsert({
          id: userId,
          venue_id: invite.venue_id,
          name,
          role: invite.role,
        }),
      ])

    if (memberError) throw memberError
    if (inviteUpdateError) throw inviteUpdateError
    if (userError) throw userError

    return NextResponse.json({ ok: true, email: invite.email })
  } catch (error) {
    return apiError(error)
  }
}
