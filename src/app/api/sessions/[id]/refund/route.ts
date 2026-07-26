import { NextResponse } from "next/server"
import { z } from "zod"
import { apiError, HttpError, requireRole } from "@/lib/billing/server"
import { withAuditContext } from "@/lib/audit"
import { formatCAD } from "@/lib/format"

// Refund / void / comp a completed sale. Partial refunds are allowed (any
// amount up to the remaining refundable balance); a void must reverse the
// full remaining balance; a comp is a manager-authorized full-or-partial
// zero-out. Owner/manager only -- staff cannot reverse money.
const RefundSchema = z.object({
  payment_id: z.string().uuid(),
  amount_cents: z.number().int().min(1).max(9_999_999),
  reason: z.string().trim().min(1).max(500),
  kind: z.enum(["refund", "void", "comp"]).default("refund"),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Role gate: owner/manager only (mirrors team/invite deletion).
    const { supabase, profile } = await requireRole(["owner", "manager"])
    const { id: sessionId } = await params

    const body = await request.json()
    const parsed = RefundSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { payment_id, amount_cents, reason, kind } = parsed.data
    const venueId = profile.venueId

    // Re-derive scope from the profile; validate the payment belongs to THIS
    // session and venue before touching money. Never trust the body's venue.
    const { data: payment, error: lookupError } = await supabase
      .from("payments")
      .select("id, status")
      .eq("id", payment_id)
      .eq("session_id", sessionId)
      .eq("venue_id", venueId)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!payment) throw new HttpError(404, "Payment not found")

    // Context attached to the audit_log rows this refund produces (the reason
    // and who/why). withAuditContext declares it here; process_refund re-applies
    // the identical context inside its own transaction, which is what the audit
    // trigger actually reads (PostgREST runs each supabase-js call in its own
    // transaction, so the outer set alone wouldn't reach the trigger -- see
    // src/lib/audit.ts).
    const auditContext = { reason, kind, payment_id, amount_cents }

    const { data, error } = await withAuditContext(supabase, auditContext, async () =>
      supabase.rpc("process_refund", {
        p_venue_id: venueId,
        p_payment_id: payment_id,
        p_amount_cents: amount_cents,
        p_reason: reason,
        p_kind: kind,
        p_actor: profile.userId,
        p_audit_context: auditContext,
      })
    )

    const mapped = mapRefundError(error)
    if (mapped) return mapped
    if (!data) return NextResponse.json({ error: "Internal server error" }, { status: 500 })

    return NextResponse.json({ ok: true, refund: data }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}

/**
 * Maps the coded exceptions raised by process_refund to client-safe responses.
 * Never leaks raw Postgres text: an unrecognized error is logged and returned
 * as a generic 500.
 */
function mapRefundError(error: { message?: string } | null): NextResponse | null {
  if (!error) return null
  const message = error.message ?? ""

  if (message.startsWith("REFUND_EXCEEDS_REMAINING:")) {
    const remaining = Number(message.split(":")[1] ?? 0)
    return NextResponse.json(
      { error: `Refund exceeds the refundable balance (${formatCAD(remaining)} remaining).` },
      { status: 400 }
    )
  }
  if (message.startsWith("VOID_MUST_BE_FULL:")) {
    const remaining = Number(message.split(":")[1] ?? 0)
    return NextResponse.json(
      { error: `A void must reverse the full remaining balance (${formatCAD(remaining)}).` },
      { status: 400 }
    )
  }
  if (message === "PAYMENT_NOT_FOUND") {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }
  if (message === "PAYMENT_NOT_REFUNDABLE") {
    return NextResponse.json(
      { error: "This payment can't be refunded (not a completed sale)." },
      { status: 409 }
    )
  }
  if (
    message === "INVALID_KIND" ||
    message === "INVALID_AMOUNT" ||
    message === "REASON_REQUIRED"
  ) {
    return NextResponse.json({ error: "Invalid refund request" }, { status: 400 })
  }

  console.error("process_refund failed:", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
