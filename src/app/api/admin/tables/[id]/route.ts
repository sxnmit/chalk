import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { dbStatusToAdmin } from "../route"

const ADMIN_ROLES = ["owner", "manager"]

const VALID_SIZES = ["9ft", "bar_box"] as const

const UpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  size: z.enum(VALID_SIZES).optional(),
  admin_status: z.enum(["active", "maintenance", "retired"]).optional(),
  display_order: z.number().int().min(0).optional(),
  default_rate_id: z.string().uuid().nullable().optional(),
})

function adminErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error"
  const status = message.includes("Not authenticated") ? 401 : 500
  return NextResponse.json({ error: status === 401 ? "Unauthorized" : message }, { status })
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

    if (parsed.data.default_rate_id) {
      const { data: rate, error: rateError } = await supabase
        .from("rates")
        .select("id")
        .eq("id", parsed.data.default_rate_id)
        .eq("venue_id", venueId)
        .maybeSingle()
      if (rateError) return NextResponse.json({ error: rateError.message }, { status: 500 })
      if (!rate) return NextResponse.json({ error: "Default rate not found for this venue" }, { status: 400 })
    }

    const dbUpdates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) dbUpdates.name = parsed.data.name
    if (parsed.data.size !== undefined) dbUpdates.size = parsed.data.size
    if (parsed.data.display_order !== undefined) dbUpdates.display_order = parsed.data.display_order
    if ("default_rate_id" in parsed.data) dbUpdates.default_rate_id = parsed.data.default_rate_id

    if (parsed.data.admin_status !== undefined) {
      if (parsed.data.admin_status === "maintenance") {
        dbUpdates.status = "maintenance"
      } else if (parsed.data.admin_status === "retired") {
        dbUpdates.status = "inactive"
      } else {
        // active: preserve 'occupied' if a session is running, otherwise reset to 'free'
        const { data: curr } = await supabase
          .from("tables")
          .select("status")
          .eq("id", id)
          .eq("venue_id", venueId)
          .single()
        dbUpdates.status = curr?.status === "occupied" ? "occupied" : "free"
      }
    }

    const { data, error } = await supabase
      .from("tables")
      .update(dbUpdates)
      .eq("id", id)
      .eq("venue_id", venueId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ...data, admin_status: dbStatusToAdmin(data.status) })
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

    const { data: table } = await supabase
      .from("tables")
      .select("id")
      .eq("id", id)
      .eq("venue_id", venueId)
      .single()
    if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("table_id", id)
      .eq("venue_id", venueId)

    if (count && count > 0) {
      // Soft-delete: retire the table to preserve session history
      const { error } = await supabase
        .from("tables")
        .update({ status: "inactive" })
        .eq("id", id)
        .eq("venue_id", venueId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from("tables")
        .delete()
        .eq("id", id)
        .eq("venue_id", venueId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return adminErrorResponse(error)
  }
}
