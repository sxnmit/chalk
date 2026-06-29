"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RateFormSheet } from "./rate-form-sheet"

export interface AdminRate {
  id: string
  label: string
  hourly_rate: number
  is_default: boolean
  active: boolean
  sort_order: number
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function RatesAdmin({ openSidebar }: { openSidebar?: () => void }) {
  const [rates, setRates] = useState<AdminRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingRate, setEditingRate] = useState<AdminRate | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/rates")
      if (!res.ok) throw new Error("Failed to load rates")
      setRates(await res.json() as AdminRate[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleToggleActive = useCallback(async (rate: AdminRate) => {
    setTogglingId(rate.id)
    try {
      const res = await fetch(`/api/admin/rates/${rate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rate.active }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert((json as { error?: string }).error ?? "Failed to update")
        return
      }
      setRates((prev) =>
        prev.map((r) => (r.id === rate.id ? { ...r, active: !r.active } : r))
      )
    } finally {
      setTogglingId(null)
    }
  }, [])

  const handleDelete = useCallback(async (rate: AdminRate) => {
    if (!confirm(`Delete "${rate.label}"? If sessions reference it, it will be deactivated instead.`)) return
    const res = await fetch(`/api/admin/rates/${rate.id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert((json as { error?: string }).error ?? "Failed to delete")
      return
    }
    await load()
  }, [load])

  const handleSaved = useCallback(() => {
    setIsSheetOpen(false)
    setEditingRate(null)
    void load()
  }, [load])

  const openCreate = () => {
    setEditingRate(null)
    setIsSheetOpen(true)
  }

  const openEdit = (rate: AdminRate) => {
    setEditingRate(rate)
    setIsSheetOpen(true)
  }

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
            <h1 className="font-heading text-3xl font-medium">Rate tiers</h1>
            <p className="mt-1 text-sm text-muted-foreground">Configure hourly pricing for your venue.</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add rate
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rates.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No rates yet — add at least one before creating tables
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4">
            <Plus className="mr-1.5 h-4 w-4" />
            Add rate
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price / hr</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id} className={rate.active ? "" : "opacity-50"}>
                  <TableCell className="font-medium text-foreground">
                    {rate.label}
                    {rate.is_default && (
                      <span className="ml-2 text-xs text-muted-foreground">(default)</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatCurrency(rate.hourly_rate)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rate.active}
                      onCheckedChange={() => handleToggleActive(rate)}
                      disabled={togglingId === rate.id}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(rate)}
                        aria-label={`Edit ${rate.label}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rate)}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${rate.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RateFormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        rate={editingRate}
        onSaved={handleSaved}
      />
    </div>
  )
}
