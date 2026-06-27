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

    // Preserve the existing 404 response before the RPC handles the locked mutation.
    const { data: orderItem, error: fetchErr } = await supabase
      .from("order_items")
      .select("id")
      .eq("id", itemId)
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .single()

    if (fetchErr || !orderItem) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data, error } = await supabase
      .rpc("update_order_item_quantity_with_stock", {
        p_venue_id: venueId,
        p_session_id: sessionId,
        p_order_item_id: itemId,
        p_quantity: parsed.data.quantity,
      })

    if (error?.message?.startsWith("INSUFFICIENT_STOCK:")) {
      const remaining = Number(error.message.split(":")[1] ?? 0)
      return NextResponse.json(
        { error: remaining === 0 ? "Item is sold out" : `Only ${remaining} more left` },
        { status: 409 }
      )
    }
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

    const { error } = await supabase
      .rpc("delete_order_item_with_stock", {
        p_venue_id: venueId,
        p_session_id: sessionId,
        p_order_item_id: itemId,
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
