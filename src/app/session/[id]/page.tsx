"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock, User, ShoppingBag, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { MenuBrowser } from "@/components/ordering/menu-browser"
import { OrderList, type OrderItem } from "@/components/ordering/order-list"
import { CartTotals } from "@/components/ordering/cart-totals"
import { getSessionDetail, getMenuItems } from "./actions"
import type { MenuItem } from "@/components/ordering/menu-item-card"
import { formatCAD } from "@/lib/format"

function formatDuration(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

interface Totals {
  table_total_cents: number
  items_total_cents: number
  tax_cents: number
  grand_total_cents: number
  order_items: OrderItem[]
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Awaited<ReturnType<typeof getSessionDetail>>>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(true)
  const [, setTick] = useState(0)

  const fetchTotals = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/totals`)
      if (!res.ok) return
      const data = await res.json()
      setTotals(data)
      setOrderItems(data.order_items ?? [])
    } catch {}
  }, [sessionId])

  // Initial load
  useEffect(() => {
    Promise.all([
      getSessionDetail(sessionId).then((s) => { setSession(s); setSessionLoading(false) }),
      getMenuItems().then((items) => { setMenuItems(items); setMenuLoading(false) }),
      fetchTotals(),
    ])
  }, [sessionId, fetchTotals])

  // Live timer tick
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Poll totals every 5s
  useEffect(() => {
    const interval = setInterval(fetchTotals, 5000)
    return () => clearInterval(interval)
  }, [fetchTotals])

  async function handleAddItem(item: MenuItem) {
    const tempId = `temp-${Date.now()}`
    const optimistic: OrderItem = {
      id: tempId,
      menu_item_id: item.id,
      name: item.name,
      quantity: 1,
      price_at_time_cents: item.price_cents,
      line_total_cents: item.price_cents,
      pending: true,
    }
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.menu_item_id === item.id)
      if (existing) {
        return prev.map((i) => i.menu_item_id === item.id
          ? { ...i, quantity: i.quantity + 1, line_total_cents: (i.quantity + 1) * i.price_at_time_cents, pending: true }
          : i)
      }
      return [...prev, optimistic]
    })

    try {
      const existing = orderItems.find((i) => i.menu_item_id === item.id)
      let res: Response
      if (existing) {
        res = await fetch(`/api/sessions/${sessionId}/items/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: existing.quantity + 1 }),
        })
      } else {
        res = await fetch(`/api/sessions/${sessionId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ menu_item_id: item.id, quantity: 1 }),
        })
      }
      if (!res.ok) throw new Error()
      await fetchTotals()
    } catch {
      toast.error("Failed to add item")
      setOrderItems((prev) => prev.filter((i) => i.id !== tempId).map((i) =>
        i.menu_item_id === item.id ? { ...i, quantity: i.quantity - 1, pending: false } : i
      ))
    }
  }

  async function handleUpdateQty(itemId: string, newQty: number) {
    setOrderItems((prev) => prev.map((i) =>
      i.id === itemId ? { ...i, quantity: newQty, line_total_cents: newQty * i.price_at_time_cents, pending: true } : i
    ))
    try {
      const res = await fetch(`/api/sessions/${sessionId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      })
      if (!res.ok) throw new Error()
      await fetchTotals()
    } catch {
      toast.error("Failed to update quantity")
      await fetchTotals()
    }
  }

  async function handleRemove(itemId: string) {
    const prev = orderItems.find((i) => i.id === itemId)
    setOrderItems((items) => items.filter((i) => i.id !== itemId))
    try {
      const res = await fetch(`/api/sessions/${sessionId}/items/${itemId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await fetchTotals()
    } catch {
      toast.error("Failed to remove item")
      if (prev) setOrderItems((items) => [...items, prev])
    }
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Session not found</p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  const elapsedSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
  const elapsedHours = elapsedSeconds / 3600
  const tableAmountCents = session.isTab
    ? 0
    : Math.round(session.actualRateCharged * 100 * elapsedHours)

  const headerTitle = session.isTab
    ? (session.playerName || "Tab")
    : (session.tableName ?? "Session")
  const headerSubtitle = session.isTab
    ? "Food & drinks tab"
    : `${session.rateName ?? "Standard"} rate`

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground font-[family-name:var(--font-exo2)]">{headerTitle}</h1>
            <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
          </div>
        </div>

        {/* Live timer card */}
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-xs font-medium text-primary">LIVE</span>
            </div>
            {session.playerName && !session.isTab && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {session.playerName}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-4xl font-bold text-foreground">{formatDuration(session.startedAt)}</span>
          </div>

          {!session.isTab && (
            <div className="flex items-center justify-center rounded-lg bg-success/10 py-3">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-success/70">Table charge</div>
                <div className="text-3xl font-bold text-success">{formatCAD(tableAmountCents)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Menu browser */}
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">Add Items</h2>
          </div>
          <MenuBrowser items={menuItems} loading={menuLoading} onAdd={handleAddItem} />
        </div>

        {/* Order list */}
        {(orderItems.length > 0 || !menuLoading) && (
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <h2 className="font-semibold text-foreground text-sm">Order</h2>
            <OrderList
              items={orderItems}
              loading={false}
              onUpdateQty={handleUpdateQty}
              onRemove={handleRemove}
            />
          </div>
        )}

        {/* Running total */}
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <h2 className="font-semibold text-foreground text-sm">Running Total</h2>
          <CartTotals
            tableTotalCents={totals?.table_total_cents ?? tableAmountCents}
            itemsTotalCents={totals?.items_total_cents ?? 0}
            taxCents={totals?.tax_cents ?? 0}
            grandTotalCents={totals?.grand_total_cents ?? tableAmountCents}
          />
        </div>

        {/* CTA */}
        <Button
          className="w-full min-h-[52px] text-base"
          size="lg"
          onClick={() => router.push(`/session/${sessionId}/checkout`)}
        >
          Close &amp; Bill →
        </Button>
      </div>
    </div>
  )
}
