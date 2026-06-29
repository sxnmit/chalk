import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const ADMIN_ROLES = ["owner", "manager"]

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(30).optional(),
  price_cents: z.number().int().min(1).max(99999).optional(),
  available: z.boolean().optional(),
  stock_quantity: z.number().int().min(0).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from("menu_items")
      .update(parsed.data)
      .eq("id", id)
      .eq("venue_id", venueId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .eq("venue_id", venueId)

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
