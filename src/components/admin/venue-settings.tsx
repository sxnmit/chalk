"use client"

import { useState, useEffect, useCallback } from "react"
import { Menu, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

export function VenueSettings({ openSidebar }: { openSidebar?: () => void }) {
  const [taxRate, setTaxRate] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/settings")
      if (!res.ok) throw new Error("Failed to load settings")
      const data = await res.json()
      setTaxRate(String(data.tax_rate ?? 0))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    const rate = parseFloat(taxRate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Tax rate must be between 0 and 100")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tax_rate: rate }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to save")
      }
      toast.success("Tax rate updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const parsedRate = parseFloat(taxRate)
  const previewTax = !isNaN(parsedRate) && parsedRate > 0
    ? `On a $50.00 subtotal, tax = $${(50 * parsedRate / 100).toFixed(2)}`
    : null

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={openSidebar}
          aria-label="Open navigation"
          className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-heading text-3xl font-medium">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure venue-level settings.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card">
        <div className="border-b border-border/50 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Tax</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-48" />
            </div>
          ) : (
            <>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="tax-rate">Tax rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="0"
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your combined sales tax rate (e.g. 13 for 13% HST).
                </p>
                {previewTax && (
                  <p className="text-xs text-muted-foreground italic">{previewTax}</p>
                )}
              </div>
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
