import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { getProfile } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const ADMIN_ROLES = ["owner", "manager"]

const SUPPORTED_CURRENCIES = ["CAD", "USD", "GBP", "EUR", "AUD"]

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES as [string, ...string[]]).optional(),
  peak_days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  peak_start_hour: z.number().int().min(0).max(23).optional(),
  peak_end_hour: z.number().int().min(0).max(23).optional(),
  business_day_cutoff_hour: z.number().int().min(0).max(23).optional(),
  receipt_footer: z.string().max(500).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
)

const VENUE_COLUMNS = "name, timezone, tax_rate, currency, peak_days, peak_start_hour, peak_end_hour, business_day_cutoff_hour, receipt_footer"

export async function GET() {
  try {
    const supabase = await createClient()
    const { venueId, role } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("venues")
      .select(VENUE_COLUMNS)
      .eq("id", venueId)
      .single()

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return NextResponse.json({
      name: data.name,
      timezone: data.timezone,
      tax_rate: Number(data.tax_rate),
      currency: data.currency,
      peak_days: data.peak_days,
      peak_start_hour: data.peak_start_hour,
      peak_end_hour: data.peak_end_hour,
      business_day_cutoff_hour: data.business_day_cutoff_hour,
      receipt_footer: data.receipt_footer,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    const status = message.includes("Not authenticated") ? 401 : 500
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error" }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { venueId, role, userId } = await getProfile()
    if (!ADMIN_ROLES.includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    if (parsed.data.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timezone })
      } catch {
        return NextResponse.json({ error: "Invalid timezone" }, { status: 400 })
      }
    }

    const changedKeys = Object.keys(parsed.data) as (keyof typeof parsed.data)[]

    const { data: before } = await supabase
      .from("venues")
      .select(VENUE_COLUMNS)
      .eq("id", venueId)
      .single()

    const { error } = await supabase
      .from("venues")
      .update(parsed.data)
      .eq("id", venueId)

    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })

    if (before) {
      const normalize: Record<string, (v: unknown) => unknown> = {
        tax_rate: (v) => Number(v),
        peak_start_hour: (v) => Number(v),
        peak_end_hour: (v) => Number(v),
        business_day_cutoff_hour: (v) => Number(v),
      }
      const beforeSlice: Record<string, unknown> = {}
      const afterSlice: Record<string, unknown> = {}
      for (const key of changedKeys) {
        const cast = normalize[key]
        const oldVal = cast ? cast(before[key]) : before[key]
        const newVal = parsed.data[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          beforeSlice[key] = oldVal
          afterSlice[key] = newVal
        }
      }

      if (Object.keys(afterSlice).length > 0) {
        await logAudit(supabase, {
          venue_id: venueId,
          actor_id: userId,
          actor_role: role,
          entity_type: "venue",
          entity_id: venueId,
          operation: "update_settings",
          before: beforeSlice,
          after: afterSlice,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    const status = message.includes("Not authenticated") ? 401 : 500
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Internal server error" }, { status })
  }
}
