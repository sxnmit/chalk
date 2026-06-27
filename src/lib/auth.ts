"use server"

import { createClient } from "@/utils/supabase/server"

export interface UserProfile {
  venueId: string
  role: string
  userId: string
}

export async function getProfile(): Promise<UserProfile> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const payload = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString()
  )

  const venueId = payload.app_metadata?.venue_id as string | undefined
  const role = payload.app_metadata?.role as string | undefined

  if (!venueId || !role) throw new Error("Missing claims — ensure custom_access_token_hook is registered")

  return { venueId, role, userId: session.user.id }
}
