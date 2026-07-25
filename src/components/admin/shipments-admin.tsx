"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Menu, Package, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ShipmentFormSheet } from "./shipment-form-sheet"
import { formatCadence, formatNextRunInTimezone } from "@/lib/shipment-schedule"
import type { MenuItem } from "@/components/ordering/menu-item-card"

export interface ShipmentItem {
  id?: string
  menu_item_id: string
  quantity: number
}

export interface AdminShipment {
  id: string
  name: string
  action: "add" | "set"
  cadence_type: "weekly" | "interval"
  weekly_days: number[] | null
  interval_days: number | null
  run_hour: number
  active: boolean
  next_run_at: string
  last_run_at: string | null
  items: ShipmentItem[]
}

interface Props {
  openSidebar?: () => void
  venueTimezone: string
}

export function ShipmentsAdmin({ openSidebar, venueTimezone }: Props) {
  const [shipments, setShipments] = useState<AdminShipment[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<AdminShipment | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [shipmentsRes, menuRes] = await Promise.all([
        fetch("/api/admin/shipments"),
        fetch("/api/menu"),
      ])
      if (!shipmentsRes.ok) throw new Error("Failed to load shipments")
      if (!menuRes.ok) throw new Error("Failed to load menu")
      setShipments(await shipmentsRes.json())
      setMenuItems(await menuRes.json())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const trackedMenuItems = menuItems.filter((m) => m.stock_quantity !== null)
  const menuById = new Map(menuItems.map((m) => [m.id, m]))

  async function toggleActive(shipment: AdminShipment) {
    setTogglingId(shipment.id)
    // Optimistic
    setShipments((prev) => prev.map((s) => s.id === shipment.id ? { ...s, active: !s.active } : s))
    try {
      const res = await fetch(`/api/admin/shipments/${shipment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !shipment.active }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Rollback
      setShipments((prev) => prev.map((s) => s.id === shipment.id ? { ...s, active: shipment.active } : s))
      toast.error("Failed to update shipment")
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteShipment(shipment: AdminShipment) {
    if (!confirm(`Delete shipment "${shipment.name}"?`)) return
    try {
      const res = await fetch(`/api/admin/shipments/${shipment.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setShipments((prev) => prev.filter((s) => s.id !== shipment.id))
      toast.success("Shipment deleted")
    } catch {
      toast.error("Failed to delete shipment")
    }
  }

  async function runNow(shipment: AdminShipment) {
    if (!confirm(`Run "${shipment.name}" now? This will ${shipment.action === "add" ? "add" : "set"} stock immediately.`)) return
    setRunningId(shipment.id)
    try {
      const res = await fetch(`/api/admin/shipments/${shipment.id}/run`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "Failed to run shipment")
      const applied = body?.applied ?? 0
      const skipped = body?.skipped ?? 0
      toast.success(
        `Ran shipment: ${applied} item${applied === 1 ? "" : "s"} updated${skipped ? `, ${skipped} skipped (untracked)` : ""}`,
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to run shipment")
    } finally {
      setRunningId(null)
    }
  }

  function openCreate() { setEditing(null); setSheetOpen(true) }
  function openEdit(shipment: AdminShipment) { setEditing(shipment); setSheetOpen(true) }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {openSidebar && (
            <button
              onClick={openSidebar}
              aria-label="Open navigation"
              className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="font-heading text-3xl font-medium">Stock shipments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Auto-restock menu items on a recurring schedule.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm" disabled={trackedMenuItems.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" />
          New shipment
        </Button>
      </div>

      {trackedMenuItems.length === 0 && !loading && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          You have no menu items with stock tracking enabled. Turn on <span className="font-medium">Track stock</span> for
          at least one item before creating a shipment.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : shipments.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card py-16 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No shipments yet. Create one to auto-restock when deliveries arrive.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border border-border/50 bg-card p-4 ${s.active ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{s.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {s.action === "add" ? "Adds units" : "Sets to"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCadence({
                      cadenceType: s.cadence_type,
                      weeklyDays: s.weekly_days,
                      intervalDays: s.interval_days,
                      runHour: s.run_hour,
                      timezone: venueTimezone,
                    })}
                    {" · "}
                    Next: {formatNextRunInTimezone(new Date(s.next_run_at), venueTimezone)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {s.items.length} item{s.items.length === 1 ? "" : "s"}:{" "}
                    {s.items
                      .slice(0, 4)
                      .map((it) => {
                        const m = menuById.get(it.menu_item_id)
                        return `${m?.name ?? "Unknown"} ${s.action === "add" ? "+" : "="}${it.quantity}`
                      })
                      .join(", ")}
                    {s.items.length > 4 ? `, +${s.items.length - 4} more` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={s.active}
                    onCheckedChange={() => toggleActive(s)}
                    disabled={togglingId === s.id}
                    aria-label={`Toggle ${s.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runNow(s)}
                    disabled={runningId === s.id}
                    aria-label={`Run ${s.name} now`}
                    title="Run now"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(s)}
                    aria-label={`Edit ${s.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteShipment(s)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ShipmentFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        shipment={editing}
        menuItems={trackedMenuItems}
        onSaved={() => { setSheetOpen(false); setEditing(null); void load() }}
      />
    </div>
  )
}
