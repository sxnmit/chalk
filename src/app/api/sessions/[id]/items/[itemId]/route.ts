import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const UpdateSchema = z.object({
  quantity: z.number().int().min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId, itemId } = await params
    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Get current order item to compute stock delta
    const { data: orderItem, error: fetchErr } = await supabase
      .from("order_items")
      .select("id, menu_item_id, quantity")
      .eq("id", itemId)
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .single()

    if (fetchErr || !orderItem) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const delta = parsed.data.quantity - orderItem.quantity // positive = need more stock

    // Adjust stock if tracked
    if (delta !== 0) {
      const { data: menuItem } = await supabase
        .from("menu_items")
        .select("stock_quantity")
        .eq("id", orderItem.menu_item_id)
        .eq("venue_id", venueId)
        .single()

      if (menuItem?.stock_quantity !== null && menuItem?.stock_quantity !== undefined) {
        if (delta > 0 && menuItem.stock_quantity < delta) {
          return NextResponse.json(
            { error: menuItem.stock_quantity === 0 ? "Item is sold out" : `Only ${menuItem.stock_quantity} more left` },
            { status: 409 }
          )
        }
        await supabase
          .from("menu_items")
          .update({ stock_quantity: menuItem.stock_quantity - delta })
          .eq("id", orderItem.menu_item_id)
          .eq("venue_id", venueId)
      }
    }

    const { data, error } = await supabase
      .from("order_items")
      .update({ quantity: parsed.data.quantity })
      .eq("id", itemId)
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId } = await getProfile()
    const { id: sessionId, itemId } = await params

    // Fetch order item to restore stock
    const { data: orderItem } = await supabase
      .from("order_items")
      .select("menu_item_id, quantity")
      .eq("id", itemId)
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .single()

    const { error } = await supabase
      .from("order_items")
      .delete()
      .eq("id", itemId)
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Restore stock
    if (orderItem) {
      const { data: menuItem } = await supabase
        .from("menu_items")
        .select("stock_quantity")
        .eq("id", orderItem.menu_item_id)
        .eq("venue_id", venueId)
        .single()

      if (menuItem?.stock_quantity !== null && menuItem?.stock_quantity !== undefined) {
        await supabase
          .from("menu_items")
          .update({ stock_quantity: menuItem.stock_quantity + orderItem.quantity })
          .eq("id", orderItem.menu_item_id)
          .eq("venue_id", venueId)
      }
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
