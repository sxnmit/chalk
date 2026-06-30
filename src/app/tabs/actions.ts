"use server"

import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import type { OpenTab, OpenTabItem } from "@/app/dashboard/actions"

export async function loadOpenTabs(): Promise<OpenTab[]> {
  const supabase = await createClient()
  const { venueId } = await getProfile()

  const { data: sessions, error: sessionsErr } = await supabase
    .from("sessions")
    .select("id, started_at, player_name")
    .eq("venue_id", venueId)
    .is("table_id", null)
    .is("ended_at", null)
    .order("started_at", { ascending: true })

  if (sessionsErr) throw sessionsErr

  const tabRows = sessions ?? []
  if (tabRows.length === 0) return []

  const sessionIds = tabRows.map((s) => s.id)

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("session_id, quantity, price_at_time_cents, menu_items(name)")
    .in("session_id", sessionIds)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true })

  if (itemsErr) throw itemsErr

  const itemsBySession = new Map<string, OpenTabItem[]>()
  const totalsBySession = new Map<string, number>()
  for (const row of items ?? []) {
    const name = (row.menu_items as unknown as { name: string } | null)?.name ?? "Item"
    const lineTotal = row.quantity * row.price_at_time_cents
    const list = itemsBySession.get(row.session_id) ?? []
    list.push({ name, quantity: row.quantity, lineTotalCents: lineTotal })
    itemsBySession.set(row.session_id, list)
    totalsBySession.set(row.session_id, (totalsBySession.get(row.session_id) ?? 0) + lineTotal)
  }

  return tabRows.map((s) => ({
    id: s.id,
    playerName: s.player_name ?? null,
    startedAt: s.started_at,
    items: itemsBySession.get(s.id) ?? [],
    totalCents: totalsBySession.get(s.id) ?? 0,
  }))
}
