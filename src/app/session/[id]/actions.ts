"use server"

import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

export interface SessionDetail {
  id: string
  tableName: string | null
  tableId: string | null
  startedAt: string
  endedAt: string | null
  actualRateCharged: number
  rateName: string | null
  playerName: string | null
  venueName: string
  isTab: boolean
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const supabase = await createClient()
  const { venueId } = await getProfile()

  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      started_at,
      ended_at,
      actual_rate_charged,
      player_name,
      table_id,
      tables (name),
      rates (label),
      venues (name)
    `)
    .eq("id", sessionId)
    .eq("venue_id", venueId)
    .single()

  if (error || !data) return null

  const tables = data.tables as unknown as { name: string } | null
  const rates = data.rates as unknown as { label: string } | null
  const venues = data.venues as unknown as { name: string } | null

  return {
    id: data.id,
    tableName: tables?.name ?? null,
    tableId: data.table_id,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    actualRateCharged: data.actual_rate_charged == null ? 0 : Number(data.actual_rate_charged),
    rateName: rates?.label ?? null,
    playerName: data.player_name,
    venueName: venues?.name ?? "Venue",
    isTab: data.table_id === null,
  }
}

export async function getMenuItems() {
  const supabase = await createClient()
  const { venueId } = await getProfile()

  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("venue_id", venueId)
    .eq("available", true)
    .order("category")
    .order("sort_order")
    .order("name")

  if (error) throw error
  return data ?? []
}
