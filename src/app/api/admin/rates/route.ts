import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const ADMIN_ROLES = ["owner", "manager"]

const CreateSchema = z.object({
  label: z.string().min(1).max(50),
  hourly_rate: z.number().min(0.01).max(999.99),
  active: z.boolean().default(true),
  sort_order: z.number().int().min(0).optional(),
  is_default: z.boolean().default(false),
})

function adminErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error"
  const status = message.includes("Not authenticated") ? 401 : 500
  return NextResponse.json({ error: status === 401 ? "Unauthorized" : message }, { status })
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("rates")
      .select("id, label, hourly_rate, is_default, active, sort_order")
      .eq("venue_id", venueId)
      .order("sort_order")
      .order("hourly_rate")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (error) {
    return adminErrorResponse(error)
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

    let sortOrder = parsed.data.sort_order
    if (sortOrder === undefined) {
      const { data: maxRow } = await supabase
        .from("rates")
        .select("sort_order")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()
      sortOrder = (maxRow?.sort_order ?? -1) + 1
    }

    if (parsed.data.is_default) {
      const { error: unsetDefaultError } = await supabase
        .from("rates")
        .update({ is_default: false })
        .eq("venue_id", venueId)
      if (unsetDefaultError) return NextResponse.json({ error: unsetDefaultError.message }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("rates")
      .insert({ ...parsed.data, sort_order: sortOrder, venue_id: venueId })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return adminErrorResponse(error)
  }
}
