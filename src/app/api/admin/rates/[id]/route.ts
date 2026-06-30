import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const ADMIN_ROLES = ["owner", "manager"]

const UpdateSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  hourly_rate: z.number().min(0.01).max(999.99).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_default: z.boolean().optional(),
})

function adminErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error"
  const status = message.includes("Not authenticated") ? 401 : 500
  if (status === 500) console.error("Admin rates error:", error)
  return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error" }, { status })
}

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

    if (parsed.data.is_default) {
      const { error: unsetDefaultError } = await supabase
        .from("rates")
        .update({ is_default: false })
        .eq("venue_id", venueId)
        .neq("id", id)
      if (unsetDefaultError) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("rates")
      .update(parsed.data)
      .eq("id", id)
      .eq("venue_id", venueId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    return adminErrorResponse(error)
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

    const { data: rate } = await supabase
      .from("rates")
      .select("id")
      .eq("id", id)
      .eq("venue_id", venueId)
      .single()
    if (!rate) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Block deletion if any table uses this as its default rate
    const { data: tablesUsingRate } = await supabase
      .from("tables")
      .select("name")
      .eq("default_rate_id", id)
      .eq("venue_id", venueId)

    if (tablesUsingRate && tablesUsingRate.length > 0) {
      const names = tablesUsingRate.map((t) => t.name).join(", ")
      return NextResponse.json(
        { error: `Cannot delete: this rate is the default for ${names}. Change those tables' default rate first.` },
        { status: 409 }
      )
    }

    // If sessions reference this rate, soft-delete instead of hard-delete
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("rate_id", id)
      .eq("venue_id", venueId)

    if (count && count > 0) {
      const { error } = await supabase
        .from("rates")
        .update({ active: false })
        .eq("id", id)
        .eq("venue_id", venueId)
      if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    } else {
      const { error } = await supabase
        .from("rates")
        .delete()
        .eq("id", id)
        .eq("venue_id", venueId)
      if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return adminErrorResponse(error)
  }
}
