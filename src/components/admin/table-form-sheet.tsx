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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminTable, AdminRate } from "./tables-admin"

const TABLE_SIZES = [
  { value: "9ft", label: "9ft" },
  { value: "bar_box", label: "Bar Box" },
]
const TABLE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "retired", label: "Retired" },
] as const
const NO_DEFAULT_RATE = "__none__"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: AdminTable | null
  rates: AdminRate[]
  onSaved: () => void
}

export function TableFormSheet({ open, onOpenChange, table, rates, onSaved }: Props) {
  const [name, setName] = useState("")
  const [size, setSize] = useState("9ft")
  const [adminStatus, setAdminStatus] = useState<"active" | "maintenance" | "retired">("active")
  const [defaultRateId, setDefaultRateId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const venueDefaultRate = rates.find((r) => r.active && r.is_default)
      setName(table?.name ?? "")
      setSize(table?.size ?? "9ft")
      setAdminStatus(table?.admin_status ?? "active")
      setDefaultRateId(table?.default_rate_id ?? venueDefaultRate?.id ?? "")
      setError(null)
    }
  }, [open, table, rates])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const body: Record<string, unknown> = {
      name: name.trim(),
      size,
      admin_status: adminStatus,
      default_rate_id: defaultRateId || null,
    }

    try {
      const url = table ? `/api/admin/tables/${table.id}` : "/api/admin/tables"
      const method = table ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to save table")
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
          <SheetTitle>{table ? "Edit table" : "Add table"}</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="table-name">Name</Label>
            <Input
              id="table-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              required
              placeholder="Table 1"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="table-size">Size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger id="table-size" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="table-default-rate">Default rate</Label>
            <Select
              value={defaultRateId || NO_DEFAULT_RATE}
              onValueChange={(value) => setDefaultRateId(value === NO_DEFAULT_RATE ? "" : value)}
            >
              <SelectTrigger id="table-default-rate" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT_RATE}>None</SelectItem>
                {rates.filter((r) => r.active).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label} (${r.hourly_rate}/hr)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="table-status">Status</Label>
            <Select value={adminStatus} onValueChange={(v) => setAdminStatus(v as typeof adminStatus)}>
              <SelectTrigger id="table-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : table ? "Save changes" : "Add table"}
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
