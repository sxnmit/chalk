import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const ADMIN_ROLES = ["owner", "manager"]

const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  size: z.string().min(1).max(50),
  admin_status: z.enum(["active", "maintenance", "retired"]).default("active"),
  display_order: z.number().int().min(0).optional(),
  default_rate_id: z.string().uuid().nullable().optional(),
})

function adminStatusToDb(adminStatus: string): string {
  if (adminStatus === "maintenance") return "maintenance"
  if (adminStatus === "retired") return "inactive"
  return "free"
}

export function dbStatusToAdmin(dbStatus: string): "active" | "maintenance" | "retired" {
  if (dbStatus === "maintenance") return "maintenance"
  if (dbStatus === "inactive") return "retired"
  return "active"
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("tables")
      .select("id, name, size, status, display_order, default_rate_id")
      .eq("venue_id", venueId)
      .order("display_order")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(
      (data ?? []).map((t) => ({ ...t, admin_status: dbStatusToAdmin(t.status) }))
    )
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

    let displayOrder = parsed.data.display_order
    if (displayOrder === undefined) {
      const { data: maxRow } = await supabase
        .from("tables")
        .select("display_order")
        .eq("venue_id", venueId)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle()
      displayOrder = (maxRow?.display_order ?? -1) + 1
    }

    const { data, error } = await supabase
      .from("tables")
      .insert({
        name: parsed.data.name,
        size: parsed.data.size,
        status: adminStatusToDb(parsed.data.admin_status),
        display_order: displayOrder,
        default_rate_id: parsed.data.default_rate_id ?? null,
        venue_id: venueId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ...data, admin_status: dbStatusToAdmin(data.status) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
