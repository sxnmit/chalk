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
      .select("id")
      .eq("id", sessionId)
      .eq("venue_id", venueId)
      .is("ended_at", null)
      .single()

    if (sessionErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    const { data: menuItem, error: itemErr } = await supabase
      .from("menu_items")
      .select("id")
      .eq("id", parsed.data.menu_item_id)
      .eq("venue_id", venueId)
      .eq("available", true)
      .single()

    if (itemErr || !menuItem) return NextResponse.json({ error: "Menu item not found or unavailable" }, { status: 404 })

    const { data, error } = await supabase
      .rpc("add_order_item_with_stock", {
        p_venue_id: venueId,
        p_session_id: sessionId,
        p_menu_item_id: parsed.data.menu_item_id,
        p_quantity: parsed.data.quantity,
      })

    if (error?.message?.startsWith("INSUFFICIENT_STOCK:")) {
      const remaining = Number(error.message.split(":")[1] ?? 0)
      return NextResponse.json(
        { error: remaining === 0 ? "Item is sold out" : `Only ${remaining} left in stock` },
        { status: 409 }
      )
    }
    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
