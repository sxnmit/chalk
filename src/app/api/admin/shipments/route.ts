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

const CadenceSchema = z.discriminatedUnion("cadence_type", [
  z.object({
    cadence_type: z.literal("weekly"),
    weekly_days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    interval_days: z.null().optional(),
  }),
  z.object({
    cadence_type: z.literal("interval"),
    interval_days: z.number().int().min(1).max(365),
    weekly_days: z.null().optional(),
  }),
])

const CreateSchema = z.intersection(
  z.object({
    name: z.string().trim().min(1).max(80),
    action: z.enum(["add", "set"]),
    run_hour: z.number().int().min(0).max(23).default(6),
    active: z.boolean().default(true),
    items: z.array(ItemSchema).min(1).max(200),
  }),
  CadenceSchema,
)

export async function GET() {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("stock_shipments")
      .select(`
        id, name, action, cadence_type, weekly_days, interval_days,
        run_hour, active, next_run_at, last_run_at, created_at, updated_at,
        items:stock_shipment_items ( id, menu_item_id, quantity )
      `)
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("shipments list error", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { venueId, role, userId } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const input = parsed.data

    const timezone = await getVenueTimezone(supabase, venueId)
    const nextRun = computeNextRun(
      {
        cadenceType: input.cadence_type,
        weeklyDays: input.cadence_type === "weekly" ? input.weekly_days : null,
        intervalDays: input.cadence_type === "interval" ? input.interval_days : null,
        runHour: input.run_hour,
        timezone,
      },
      new Date(),
    )

    // Validate all menu_item_ids belong to this venue -- tenancy backstop.
    const menuIds = Array.from(new Set(input.items.map((i) => i.menu_item_id)))
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

    const { data: shipment, error: insertErr } = await supabase
      .from("stock_shipments")
      .insert({
        venue_id: venueId,
        name: input.name,
        action: input.action,
        cadence_type: input.cadence_type,
        weekly_days: input.cadence_type === "weekly" ? input.weekly_days : null,
        interval_days: input.cadence_type === "interval" ? input.interval_days : null,
        run_hour: input.run_hour,
        active: input.active,
        next_run_at: nextRun.toISOString(),
        created_by: userId,
      })
      .select()
      .single()

    if (insertErr || !shipment) {
      console.error("shipments insert error", insertErr)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    const { error: itemsErr } = await supabase
      .from("stock_shipment_items")
      .insert(
        input.items.map((i) => ({
          shipment_id: shipment.id,
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
        })),
      )
    if (itemsErr) {
      console.error("shipments items insert error", itemsErr)
      // Roll back the parent row so we don't leave an empty shipment behind.
      await supabase.from("stock_shipments").delete().eq("id", shipment.id)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json(shipment, { status: 201 })
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
