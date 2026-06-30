import type { SupabaseClient } from "@supabase/supabase-js"

export async function getVenueTaxRate(
  supabase: SupabaseClient,
  venueId: string
): Promise<number> {
  const { data } = await supabase
    .from("venues")
    .select("tax_rate")
    .eq("id", venueId)
    .single()

  return data?.tax_rate ? Number(data.tax_rate) / 100 : 0
}

export function computeTaxCents(subtotalCents: number, taxRate: number): number {
  return Math.round(subtotalCents * taxRate)
}
