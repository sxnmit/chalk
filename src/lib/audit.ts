import type { createClient } from "@/utils/supabase/server"

type Supabase = Awaited<ReturnType<typeof createClient>>

// set_audit_context() uses set_config(..., true), which is transaction-local.
// PostgREST commits one transaction per HTTP request, so `fn` must perform
// its mutation as a single RPC that sets the config and mutates in the same
// plpgsql body -- two separate supabase-js calls (this RPC, then a plain
// .update()/.insert()) run in separate transactions and the context will
// silently come back null.
export async function withAuditContext<T>(
  supabase: Supabase,
  context: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const { error } = await supabase.rpc("set_audit_context", { ctx: context })
  if (error) throw error
  return fn()
}

const SKIP_FIELDS = new Set(["id", "venue_id", "created_at"])

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "∅"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

/** Human-readable diff of an audit_log row's before/after JSONB, e.g. "hourly_rate: 15 → 20; is_default: false → true". */
export function formatAuditDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string {
  if (!before && after) return "Created"
  if (before && !after) return "Deleted"
  if (!before || !after) return ""

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => !SKIP_FIELDS.has(k))
    .sort()

  const changes = keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => `${k}: ${formatValue(before[k])} → ${formatValue(after[k])}`)

  return changes.length > 0 ? changes.join("; ") : "No field changes"
}
