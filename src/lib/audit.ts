import { SupabaseClient } from "@supabase/supabase-js"

interface AuditEntry {
  venue_id: string
  actor_id: string
  actor_role: string
  entity_type: string
  entity_id: string
  operation: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  context?: Record<string, unknown>
}

export async function logAudit(supabase: SupabaseClient, entry: AuditEntry) {
  const { error } = await supabase.from("audit_log").insert(entry)
  if (error) console.error("audit_log insert failed:", error.message)
}
