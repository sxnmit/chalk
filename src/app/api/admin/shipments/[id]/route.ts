import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { computeNextRun } from "@/lib/shipment-schedule"

const ADMIN_ROLES = ["owner", "manager"]

const ItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(0).max(100000),
})

// PATCH accepts a partial update. When cadence fields change we recompute
// next_run_at so the new schedule takes effect immediately, not on the next
// firing.
const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  action: z.enum(["add", "set"]).optional(),
  cadence_type: z.enum(["weekly", "interval"]).optional(),
  weekly_days: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable().optional(),
  interval_days: z.number().int().min(1).max(365).nullable().optional(),
  run_hour: z.number().int().min(0).max(23).optional(),
  active: z.boolean().optional(),
  items: z.array(ItemSchema).min(1).max(200).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id } = await params
    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const patch = parsed.data

    const { data: existing, error: fetchErr } = await supabase
      .from("stock_shipments")
      .select("*")
      .eq("id", id)
      .eq("venue_id", venueId)
      .maybeSingle()
    if (fetchErr) {
      console.error("shipments fetch error", fetchErr)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const merged = {
      cadence_type: patch.cadence_type ?? existing.cadence_type,
      weekly_days: patch.weekly_days ?? existing.weekly_days,
      interval_days: patch.interval_days ?? existing.interval_days,
      run_hour: patch.run_hour ?? existing.run_hour,
    }

    // Coerce the mutually-exclusive cadence fields based on the effective type,
    // so we don't send a nonsense pairing to the CHECK constraint.
    if (merged.cadence_type === "weekly") {
      merged.interval_days = null
      if (!merged.weekly_days || merged.weekly_days.length === 0) {
        return NextResponse.json({ error: "weekly cadence requires weekly_days" }, { status: 400 })
      }
    } else {
      merged.weekly_days = null
      if (!merged.interval_days || merged.interval_days < 1) {
        return NextResponse.json({ error: "interval cadence requires interval_days" }, { status: 400 })
      }
    }

    const cadenceChanged =
      patch.cadence_type !== undefined ||
      patch.weekly_days !== undefined ||
      patch.interval_days !== undefined ||
      patch.run_hour !== undefined

    let nextRunAt = existing.next_run_at
    if (cadenceChanged) {
      const timezone = await getVenueTimezone(supabase, venueId)
      nextRunAt = computeNextRun(
        {
          cadenceType: merged.cadence_type,
          weeklyDays: merged.weekly_days,
          intervalDays: merged.interval_days,
          runHour: merged.run_hour,
          timezone,
        },
        new Date(),
      ).toISOString()
    }

    const updatePayload: Record<string, unknown> = {
      cadence_type: merged.cadence_type,
      weekly_days: merged.weekly_days,
      interval_days: merged.interval_days,
      run_hour: merged.run_hour,
      next_run_at: nextRunAt,
    }
    if (patch.name !== undefined) updatePayload.name = patch.name
    if (patch.action !== undefined) updatePayload.action = patch.action
    if (patch.active !== undefined) updatePayload.active = patch.active

    const { data, error } = await supabase
      .from("stock_shipments")
      .update(updatePayload)
      .eq("id", id)
      .eq("venue_id", venueId)
      .select()
      .single()

    if (error) {
      console.error("shipments update error", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    if (patch.items) {
      // Validate menu items belong to this venue.
      const menuIds = Array.from(new Set(patch.items.map((i) => i.menu_item_id)))
      const { data: menuRows, error: menuErr } = await supabase
        .from("menu_items")
        .select("id")
        .eq("venue_id", venueId)
        .in("id", menuIds)
      if (menuErr) {
        console.error("shipments menu lookup error", menuErr)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }
      if ((menuRows?.length ?? 0) !== menuIds.length) {
        return NextResponse.json(
          { error: "One or more menu items do not belong to this venue" },
          { status: 400 },
        )
      }

      // Replace-in-place: delete existing rows, then insert the new set. The
      // items table is small (usually <20 rows/shipment) so this is cheap.
      const { error: delErr } = await supabase
        .from("stock_shipment_items")
        .delete()
        .eq("shipment_id", id)
      if (delErr) {
        console.error("shipments items clear error", delErr)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }
      const { error: insErr } = await supabase
        .from("stock_shipment_items")
        .insert(patch.items.map((i) => ({ shipment_id: id, ...i })))
      if (insErr) {
        console.error("shipments items insert error", insErr)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { id } = await params
    const { error } = await supabase
      .from("stock_shipments")
      .delete()
      .eq("id", id)
      .eq("venue_id", venueId)
    if (error) {
      console.error("shipments delete error", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

async function getVenueTimezone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
): Promise<string> {
  const { data } = await supabase
    .from("venues")
    .select("timezone")
    .eq("id", venueId)
    .maybeSingle()
  return data?.timezone ?? "UTC"
}
