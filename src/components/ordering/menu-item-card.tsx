"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCAD } from "@/lib/format"

export interface MenuItem {
  id: string
  name: string
  category: string
  price_cents: number
  available: boolean
  sort_order: number
}

interface MenuItemCardProps {
  item: MenuItem
  onAdd: (item: MenuItem) => void
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  return (
    <button
      onClick={() => onAdd(item)}
      disabled={!item.available}
      className="flex w-full flex-col gap-1 rounded-xl border border-border/50 bg-card p-3 text-left transition-all hover:border-primary/50 hover:bg-card/80 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none min-h-[44px]"
      aria-label={`Add ${item.name} — ${formatCAD(item.price_cents)}`}
    >
      <span className="font-medium text-foreground text-sm leading-tight">{item.name}</span>
      <span className="text-success font-semibold text-sm">{formatCAD(item.price_cents)}</span>
      <Plus className="absolute top-2 right-2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </button>
  )
}
