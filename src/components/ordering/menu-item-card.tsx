"use client"

import { Plus } from "lucide-react"
import { formatCAD } from "@/lib/format"

export interface MenuItem {
  id: string
  name: string
  category: string
  price_cents: number
  available: boolean
  stock_quantity: number | null
}

interface MenuItemCardProps {
  item: MenuItem
  onAdd: (item: MenuItem) => void
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  const isSoldOut = item.stock_quantity === 0
  const isLowStock = item.stock_quantity !== null && item.stock_quantity > 0 && item.stock_quantity <= 5
  const isDisabled = !item.available || isSoldOut

  return (
    <button
      onClick={() => onAdd(item)}
      disabled={isDisabled}
      className="group relative flex w-full flex-col gap-1 rounded-xl border border-border/50 bg-card p-3 text-left transition-all hover:border-primary/50 hover:bg-card/80 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none min-h-[44px]"
      aria-label={`Add ${item.name} — ${formatCAD(item.price_cents)}${isSoldOut ? " (sold out)" : ""}`}
    >
      <span className="font-medium text-foreground text-sm leading-tight pr-5">{item.name}</span>
      <span className="text-success font-semibold text-sm">{formatCAD(item.price_cents)}</span>

      {isSoldOut && (
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
          Sold out
        </span>
      )}
      {isLowStock && (
        <span className="mt-0.5 text-[10px] font-medium text-amber-400">
          {item.stock_quantity} left
        </span>
      )}

      {!isDisabled && (
        <Plus className="absolute top-2.5 right-2.5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
      )}
    </button>
  )
}
