import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"

const ADMIN_ROLES = ["owner", "manager"]

const PatchSchema = z.object({
  tax_rate: z.number().min(0).max(100),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("venues")
      .select("tax_rate")
      .eq("id", venueId)
      .single()

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return NextResponse.json({ tax_rate: Number(data.tax_rate) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    const status = message.includes("Not authenticated") ? 401 : 500
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error" }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { error } = await supabase
      .from("venues")
      .update({ tax_rate: parsed.data.tax_rate })
      .eq("id", venueId)

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return NextResponse.json({ tax_rate: parsed.data.tax_rate })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    const status = message.includes("Not authenticated") ? 401 : 500
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error" }, { status })
  }
}
