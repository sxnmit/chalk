"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AdminShipment, ShipmentItem } from "./shipments-admin"
import type { MenuItem } from "@/components/ordering/menu-item-card"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}))

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipment: AdminShipment | null
  menuItems: MenuItem[]
  onSaved: () => void
}

interface DraftItem extends ShipmentItem {
  key: string
}

export function ShipmentFormSheet({ open, onOpenChange, shipment, menuItems, onSaved }: Props) {
  const isEdit = !!shipment

  const [name, setName] = useState("")
  const [action, setAction] = useState<"add" | "set">("add")
  const [cadenceType, setCadenceType] = useState<"weekly" | "interval">("weekly")
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]) // Mon default
  const [intervalDays, setIntervalDays] = useState<string>("7")
  const [runHour, setRunHour] = useState<number>(6)
  const [items, setItems] = useState<DraftItem[]>([])
  const [addMenuId, setAddMenuId] = useState<string>("")
  const [addQty, setAddQty] = useState<string>("1")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (shipment) {
      setName(shipment.name)
      setAction(shipment.action)
      setCadenceType(shipment.cadence_type)
      setWeeklyDays(shipment.weekly_days ?? [1])
      setIntervalDays(shipment.interval_days ? String(shipment.interval_days) : "7")
      setRunHour(shipment.run_hour)
      setItems(
        shipment.items.map((i, idx) => ({
          key: i.id ?? `existing-${idx}`,
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
        })),
      )
    } else {
      setName("")
      setAction("add")
      setCadenceType("weekly")
      setWeeklyDays([1])
      setIntervalDays("7")
      setRunHour(6)
      setItems([])
    }
    setAddMenuId("")
    setAddQty("1")
  }, [open, shipment])

  const usedMenuIds = useMemo(() => new Set(items.map((i) => i.menu_item_id)), [items])
  const availableMenuItems = menuItems.filter((m) => !usedMenuIds.has(m.id))
  const menuById = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems])

  function toggleDay(day: number) {
    setWeeklyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    )
  }

  function addItem() {
    if (!addMenuId) return
    const qty = parseInt(addQty, 10)
    if (isNaN(qty) || qty < 0) {
      toast.error("Quantity must be a non-negative integer")
      return
    }
    setItems((prev) => [
      ...prev,
      { key: `${addMenuId}-${Date.now()}`, menu_item_id: addMenuId, quantity: qty },
    ])
    setAddMenuId("")
    setAddQty("1")
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function updateItemQty(key: string, value: string) {
    const qty = parseInt(value, 10)
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, quantity: isNaN(qty) ? 0 : qty } : i)),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError("Name is required"); return }
    if (items.length === 0) { setError("Add at least one item"); return }
    if (cadenceType === "weekly" && weeklyDays.length === 0) {
      setError("Pick at least one day of the week")
      return
    }
    let intervalNum = 0
    if (cadenceType === "interval") {
      intervalNum = parseInt(intervalDays, 10)
      if (isNaN(intervalNum) || intervalNum < 1 || intervalNum > 365) {
        setError("Interval must be between 1 and 365 days")
        return
      }
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      action,
      cadence_type: cadenceType,
      weekly_days: cadenceType === "weekly" ? weeklyDays : null,
      interval_days: cadenceType === "interval" ? intervalNum : null,
      run_hour: runHour,
      items: items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
    }

    setSaving(true)
    try {
      const url = isEdit ? `/api/admin/shipments/${shipment!.id}` : "/api/admin/shipments"
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(typeof body?.error === "string" ? body.error : "Failed to save shipment")
        return
      }
      toast.success(isEdit ? "Shipment updated" : "Shipment created")
      onSaved()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit shipment" : "New shipment"}</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="shipment-name">Name</Label>
            <Input
              id="shipment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              placeholder="e.g. Beer delivery"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Action</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAction("add")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  action === "add"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Add units
              </button>
              <button
                type="button"
                onClick={() => setAction("set")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  action === "set"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-primary/10"
                }`}
              >
                Set stock to
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {action === "add"
                ? "Adds the quantity to whatever stock is currently on hand — matches a real delivery."
                : "Overwrites current stock with the quantity — matches a par-level top-up."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Cadence</Label>
            <Tabs value={cadenceType} onValueChange={(v) => setCadenceType(v as "weekly" | "interval")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="interval">Every N days</TabsTrigger>
              </TabsList>
            </Tabs>

            {cadenceType === "weekly" ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      weeklyDays.includes(i)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/50 bg-secondary/50 text-muted-foreground hover:bg-primary/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="pt-2">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  className="max-w-[120px]"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Fires N days after each run, starting N days from now.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="run-hour">Time of day</Label>
            <select
              id="run-hour"
              value={runHour}
              onChange={(e) => setRunHour(parseInt(e.target.value))}
              className="h-10 w-full max-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Fires around this time in your venue timezone.</p>
          </div>

          <div className="space-y-2">
            <Label>Items in this shipment</Label>
            {items.length > 0 ? (
              <div className="space-y-1.5 rounded-lg border border-border/50 bg-secondary/20 p-2">
                {items.map((i) => {
                  const m = menuById.get(i.menu_item_id)
                  return (
                    <div key={i.key} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{m?.name ?? "Unknown"}</span>
                      <Input
                        type="number"
                        min="0"
                        max="100000"
                        value={i.quantity}
                        onChange={(e) => updateItemQty(i.key, e.target.value)}
                        className="h-8 w-20 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(i.key)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${m?.name ?? "item"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No items yet.</p>
            )}

            {availableMenuItems.length > 0 ? (
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={addMenuId}
                  onChange={(e) => setAddMenuId(e.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Pick an item…</option>
                  {availableMenuItems.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="0"
                  max="100000"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="h-10 w-20"
                />
                <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!addMenuId}>
                  Add
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">All tracked items are already in this shipment.</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create shipment"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
