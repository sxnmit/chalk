"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { MenuItem } from "./menu-item-card"

const PRESET_CATEGORIES = ["Drinks", "Food", "Snacks"]

interface MenuItemFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: MenuItem | null
  existingCategories?: string[]
  onSaved: () => void
}

export function MenuItemFormSheet({ open, onOpenChange, item, existingCategories = [], onSaved }: MenuItemFormSheetProps) {
  const isEdit = !!item
  const allCategories = Array.from(new Set([...PRESET_CATEGORIES, ...existingCategories]))

  const [name, setName] = useState("")
  const [category, setCategory] = useState("Drinks")
  const [customCategory, setCustomCategory] = useState("")
  const [priceDollars, setPriceDollars] = useState("")
  const [available, setAvailable] = useState(true)
  const [trackStock, setTrackStock] = useState(false)
  const [stockQty, setStockQty] = useState("0")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "")
      const cat = item?.category ?? "Drinks"
      if (allCategories.includes(cat)) {
        setCategory(cat)
        setCustomCategory("")
      } else {
        setCategory("__custom__")
        setCustomCategory(cat)
      }
      setPriceDollars(item ? (item.price_cents / 100).toFixed(2) : "")
      setAvailable(item?.available ?? true)
      const hasStock = item?.stock_quantity !== null && item?.stock_quantity !== undefined
      setTrackStock(hasStock)
      setStockQty(hasStock ? String(item!.stock_quantity) : "0")
    }
  }, [open, item])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalCategory = category === "__custom__" ? customCategory.trim() : category
    if (!finalCategory) { toast.error("Category is required"); return }
    const price = Math.round(parseFloat(priceDollars) * 100)
    if (isNaN(price) || price < 1 || price > 99999) {
      toast.error("Price must be between $0.01 and $999.99")
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        category: finalCategory,
        price_cents: price,
        available,
        stock_quantity: trackStock ? (parseInt(stockQty) || 0) : null,
      }
      const url = isEdit ? `/api/menu/${item!.id}` : "/api/menu"
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(await res.text())
      toast.success(isEdit ? "Item updated" : "Item added")
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error("Failed to save item")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-sm overflow-y-auto px-6 py-4">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Item" : "Add Menu Item"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              placeholder="e.g. Bottled Water"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="item-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="__custom__">+ Custom…</SelectItem>
              </SelectContent>
            </Select>
            {category === "__custom__" && (
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                maxLength={30}
                placeholder="Category name"
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-price">Price (CAD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="item-price"
                className="pl-7"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                max="999.99"
                type="number"
                required
              />
            </div>
          </div>

          {/* Stock tracking */}
          <div className="rounded-lg border border-border/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="track-stock" className="text-sm font-medium">Track stock</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trackStock ? "Shows sold out when stock hits 0" : "Unlimited — no stock limit"}
                </p>
              </div>
              <Switch
                id="track-stock"
                checked={trackStock}
                onCheckedChange={setTrackStock}
                aria-label="Track stock quantity"
              />
            </div>

            {trackStock && (
              <div className="space-y-1.5">
                <Label htmlFor="stock-qty">Units available</Label>
                <Input
                  id="stock-qty"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="item-available"
              checked={available}
              onCheckedChange={setAvailable}
              aria-label="Available"
            />
            <Label htmlFor="item-available">Available for ordering</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
