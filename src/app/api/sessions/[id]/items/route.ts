import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const AddItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId } = await params
    const body = await request.json()
    const parsed = AddItemSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Validate session belongs to venue and is still active
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, venue_id")
      .eq("id", sessionId)
      .eq("venue_id", venueId)
      .is("ended_at", null)
      .single()

    if (sessionErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    // Validate menu item belongs to venue and snapshot price
    const { data: menuItem, error: itemErr } = await supabase
      .from("menu_items")
      .select("id, price_cents")
      .eq("id", parsed.data.menu_item_id)
      .eq("venue_id", venueId)
      .eq("available", true)
      .single()

    if (itemErr || !menuItem) return NextResponse.json({ error: "Menu item not found" }, { status: 404 })

    const { data, error } = await supabase
      .from("order_items")
      .insert({
        venue_id: venueId,
        session_id: sessionId,
        menu_item_id: parsed.data.menu_item_id,
        quantity: parsed.data.quantity,
        price_at_time_cents: menuItem.price_cents,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
