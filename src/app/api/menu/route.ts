import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const ADMIN_ROLES = ["owner", "manager"]

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(30),
  price_cents: z.number().int().min(1).max(99999),
  available: z.boolean().default(true),
  stock_quantity: z.number().int().min(0).nullable().default(null),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", venueId)
      .order("category")
      .order("name")

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from("menu_items")
      .insert({ ...parsed.data, venue_id: venueId })
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
