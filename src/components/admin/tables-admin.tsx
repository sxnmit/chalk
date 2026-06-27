"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableFormSheet } from "./table-form-sheet"

export interface AdminTable {
  id: string
  name: string
  size: string
  status: string
  admin_status: "active" | "maintenance" | "retired"
  display_order: number
  default_rate_id: string | null
}

export interface AdminRate {
  id: string
  label: string
  hourly_rate: number
  active: boolean
  sort_order: number
  is_default: boolean
}

function StatusPill({ status }: { status: "active" | "maintenance" | "retired" }) {
  const cfg = {
    active:      { cls: "bg-green-500/15 text-green-400 border border-green-500/30",  label: "Active" },
    maintenance: { cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30",  label: "Maintenance" },
    retired:     { cls: "bg-muted text-muted-foreground border border-border",         label: "Retired" },
  }[status]

  return (
    <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

interface Props {
  ratesForForm?: AdminRate[]
}

export function TablesAdmin({ ratesForForm }: Props) {
  const [tables, setTables] = useState<AdminTable[]>([])
  const [rates, setRates] = useState<AdminRate[]>(ratesForForm ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTable, setEditingTable] = useState<AdminTable | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tablesRes, ratesRes] = await Promise.all([
        fetch("/api/admin/tables"),
        fetch("/api/admin/rates"),
      ])
      if (!tablesRes.ok) throw new Error("Failed to load tables")
      if (!ratesRes.ok) throw new Error("Failed to load rates")
      const [tablesData, ratesData] = await Promise.all([
        tablesRes.json() as Promise<AdminTable[]>,
        ratesRes.json() as Promise<AdminRate[]>,
      ])
      setTables(tablesData)
      setRates(ratesData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? If sessions exist it will be retired instead.`)) return
    const res = await fetch(`/api/admin/tables/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert((json as { error?: string }).error ?? "Failed to delete")
      return
    }
    await load()
  }, [load])

  const handleSaved = useCallback(() => {
    setIsSheetOpen(false)
    setEditingTable(null)
    void load()
  }, [load])

  const openCreate = () => {
    setEditingTable(null)
    setIsSheetOpen(true)
  }

  const openEdit = (table: AdminTable) => {
    setEditingTable(table)
    setIsSheetOpen(true)
  }

  const rateLabel = (rateId: string | null) => {
    if (!rateId) return "—"
    const r = rates.find((x) => x.id === rateId)
    return r ? `${r.label} ($${r.hourly_rate}/hr)` : "—"
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold uppercase tracking-widest text-foreground">Tables</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add table
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
      ) : tables.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No tables yet — add your first to get started
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4">
            <Plus className="mr-1.5 h-4 w-4" />
            Add table
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Default rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium text-foreground">{table.name}</TableCell>
                  <TableCell className="text-muted-foreground">{table.size}</TableCell>
                  <TableCell className="text-muted-foreground">{rateLabel(table.default_rate_id)}</TableCell>
                  <TableCell>
                    <StatusPill status={table.admin_status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{table.display_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(table)}
                        aria-label={`Edit ${table.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(table.id, table.name)}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${table.name}`}
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

      <TableFormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        table={editingTable}
        rates={rates}
        onSaved={handleSaved}
      />
    </div>
  )
}
