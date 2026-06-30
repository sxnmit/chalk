"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import type { OpenTab } from "@/app/dashboard/actions"
import { formatTime } from "@/lib/pool-types"
import { formatCAD } from "@/lib/format"

const MAX_VISIBLE_ITEMS = 5

export interface TabCardProps {
  tab: OpenTab
}

export function TabCard({ tab }: TabCardProps) {
  const startTime = new Date(tab.startedAt)

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-primary/50 bg-card shadow-lg shadow-primary/10 transition-all">
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-xs font-medium text-primary">LIVE</span>
      </div>

      <div className="flex items-center gap-3 p-4 pb-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            {tab.playerName || "Tab"}
          </h3>
          <span className="text-sm text-primary">Open tab</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="flex flex-1 flex-col py-2">
          {tab.items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl bg-primary/5 px-4 py-6 text-center">
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-primary/70">
                  Food & Drinks Tab
                </div>
                <div className="text-sm text-muted-foreground">
                  No items yet
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 rounded-xl bg-primary/5 px-3 py-3">
              {tab.items.slice(0, MAX_VISIBLE_ITEMS).map((item, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">
                    <span className="text-muted-foreground">{item.quantity}×</span>{" "}
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCAD(item.lineTotalCents)}
                  </span>
                </div>
              ))}
              {tab.items.length > MAX_VISIBLE_ITEMS && (
                <div className="pt-0.5 text-xs text-muted-foreground">
                  +{tab.items.length - MAX_VISIBLE_ITEMS} more
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Started {formatTime(startTime)}</span>
            <span className="font-semibold text-success tabular-nums">
              {formatCAD(tab.totalCents)}
            </span>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Link
            href={`/session/${tab.id}`}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <ShoppingBag className="h-4 w-4" />
            Order & Bill
          </Link>
        </div>
      </div>
    </div>
  )
}
