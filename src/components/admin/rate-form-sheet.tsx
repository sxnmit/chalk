"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetCloseButton,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { AdminRate } from "./rates-admin"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rate: AdminRate | null
  onSaved: () => void
}

export function RateFormSheet({ open, onOpenChange, rate, onSaved }: Props) {
  const [label, setLabel] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [active, setActive] = useState(true)
  const [sortOrder, setSortOrder] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLabel(rate?.label ?? "")
      setHourlyRate(rate ? String(rate.hourly_rate) : "")
      setActive(rate?.active ?? true)
      setSortOrder(rate?.sort_order !== undefined ? String(rate.sort_order) : "")
      setError(null)
    }
  }, [open, rate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedRate = parseFloat(hourlyRate)
    if (isNaN(parsedRate) || parsedRate < 0.01 || parsedRate > 999.99) {
      setError("Price must be between $0.01 and $999.99")
      return
    }

    setSaving(true)
    const body: Record<string, unknown> = {
      label: label.trim(),
      hourly_rate: parsedRate,
      active,
    }
    if (sortOrder !== "") body.sort_order = parseInt(sortOrder, 10)

    try {
      const url = rate ? `/api/admin/rates/${rate.id}` : "/api/admin/rates"
      const method = rate ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to save rate")
        return
      }
      onSaved()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{rate ? "Edit rate" : "Add rate"}</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="rate-label">Name</Label>
            <Input
              id="rate-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={50}
              required
              placeholder="Standard"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rate-price">Price per hour ($)</Label>
            <Input
              id="rate-price"
              type="number"
              step="0.01"
              min="0.01"
              max="999.99"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              required
              placeholder="25.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rate-order">Sort order</Label>
            <Input
              id="rate-order"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="Auto"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-4 py-3">
            <Label htmlFor="rate-active" className="cursor-pointer">
              Active
              <span className="ml-1.5 text-xs text-muted-foreground">
                (inactive rates are hidden from new sessions)
              </span>
            </Label>
            <Switch
              id="rate-active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : rate ? "Save changes" : "Add rate"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
