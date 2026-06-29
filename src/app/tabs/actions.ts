"use server"

import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import type { OpenTab } from "@/app/dashboard/actions"

export async function loadOpenTabs(): Promise<OpenTab[]> {
  const supabase = await createClient()
  const { venueId } = await getProfile()

  const { data, error } = await supabase
    .from("sessions")
    .select("id, started_at, player_name")
    .eq("venue_id", venueId)
    .is("table_id", null)
    .is("ended_at", null)
    .order("started_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map((s) => ({
    id: s.id,
    playerName: s.player_name ?? null,
    startedAt: s.started_at,
  }))
}
