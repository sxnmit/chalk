"use client"

import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCAD } from "@/lib/format"

export interface OrderItem {
  id: string
  menu_item_id: string
  name: string
  quantity: number
  price_at_time_cents: number
  line_total_cents: number
  pending?: boolean
}

interface OrderListProps {
  items: OrderItem[]
  loading: boolean
  onUpdateQty: (itemId: string, newQty: number) => void
  onRemove: (itemId: string) => void
}

export function OrderList({ items, loading, onUpdateQty, onRemove }: OrderListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
        <ShoppingCart className="h-6 w-6" />
        <p className="text-sm">No items added yet</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2" aria-label="Order items">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2 transition-opacity ${item.pending ? "opacity-60" : ""}`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">{formatCAD(item.price_at_time_cents)} each</p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => item.quantity > 1 ? onUpdateQty(item.id, item.quantity - 1) : onRemove(item.id)}
              aria-label={`Decrease quantity of ${item.name}`}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onUpdateQty(item.id, item.quantity + 1)}
              aria-label={`Increase quantity of ${item.name}`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <span className="w-16 text-right text-sm font-semibold text-success tabular-nums shrink-0">
            {formatCAD(item.line_total_cents)}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
