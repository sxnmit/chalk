import { NextResponse } from "next/server"
import { apiError, requireRole } from "@/lib/billing/server"

export async function GET() {
  try {
    const { supabase, profile } = await requireRole(["owner", "manager"])

    const [{ data: members, error: membersError }, { data: invites, error: invitesError }] =
      await Promise.all([
        supabase
          .from("venue_members")
          .select("id, user_id, role, created_at")
          .eq("venue_id", profile.venueId)
          .order("created_at", { ascending: true }),
        supabase
          .from("venue_invites")
          .select("id, email, role, created_at, expires_at")
          .eq("venue_id", profile.venueId)
          .is("accepted_at", null)
          .order("created_at", { ascending: false }),
      ])

    if (membersError) throw membersError
    if (invitesError) throw invitesError

    const userIds = (members ?? []).map((member) => member.user_id)
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase.from("users").select("id, name").in("id", userIds)
      : { data: [], error: null }
    if (profilesError) throw profilesError

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

    return NextResponse.json({
      role: profile.role,
      currentUserId: profile.userId,
      members: (members ?? []).map((member) => ({
        ...member,
        name: profileById.get(member.user_id)?.name ?? null,
      })),
      invites: invites ?? [],
    })
  } catch (error) {
    return apiError(error)
  }
}
