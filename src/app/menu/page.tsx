"use client"

import { useEffect, useState, useMemo } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { LayoutDashboard, Menu, Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarPageLayout } from "@/components/dashboard/sidebar-page-layout"
import { MenuItemFormSheet } from "@/components/ordering/menu-item-form-sheet"
import type { MenuItem } from "@/components/ordering/menu-item-card"
import { formatCAD } from "@/lib/format"

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [activeCategory, setActiveCategory] = useState("All")

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/menu")
      if (!res.ok) throw new Error()
      setItems(await res.json())
    } catch {
      toast.error("Failed to load menu")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category))).sort()
    return ["All", ...cats]
  }, [items])

  const filtered = useMemo(
    () => activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  )

  async function toggleAvailable(item: MenuItem) {
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, available: !i.available } : i))
    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Rollback
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, available: item.available } : i))
      toast.error("Failed to update availability")
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      const res = await fetch(`/api/menu/${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success("Item deleted")
    } catch {
      toast.error("Failed to delete item")
    }
  }

  function openAdd() { setEditItem(null); setSheetOpen(true) }
  function openEdit(item: MenuItem) { setEditItem(item); setSheetOpen(true) }

  const existingCategories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items])

  return (
    <SidebarPageLayout>
      {(openSidebar) => (
        <>
          <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
            <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={openSidebar}
              aria-label="Open navigation"
              className="touch-manipulation flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-primary transition-colors hover:bg-primary/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-heading text-3xl font-medium">Menu</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage items available for ordering</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="h-11 px-4">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button onClick={openAdd} className="h-11 px-4">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Category tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
          <TabsList variant="line" className="w-full justify-start overflow-x-auto flex-nowrap h-auto pb-0">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="shrink-0">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <p className="text-sm">{activeCategory === "All" ? "No items yet. Add your first menu item." : `No items in ${activeCategory}.`}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Available</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="border-border/50">
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success tabular-nums">
                      {formatCAD(item.price_cents)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {item.stock_quantity === null ? (
                        <span className="text-xs text-muted-foreground">∞</span>
                      ) : item.stock_quantity === 0 ? (
                        <span className="text-xs font-semibold text-destructive">Sold out</span>
                      ) : (
                        <span className={`text-sm font-medium ${item.stock_quantity <= 5 ? "text-amber-400" : "text-foreground"}`}>
                          {item.stock_quantity}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={item.available}
                        onCheckedChange={() => toggleAvailable(item)}
                        aria-label={`Toggle availability for ${item.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteItem(item)}
                          aria-label={`Delete ${item.name}`}
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
            </div>
          </main>

          <MenuItemFormSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            item={editItem}
            existingCategories={existingCategories}
            onSaved={load}
          />
        </>
      )}
    </SidebarPageLayout>
  )
}
