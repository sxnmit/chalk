"use client"

import Link from "next/link"
import { User, ShoppingBag } from "lucide-react"
import type { OpenTab } from "@/app/dashboard/actions"
import { formatTime } from "@/lib/pool-types"

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
        <div className="flex flex-1 flex-col justify-between py-2">
          {tab.playerName && (
            <div className="flex items-center gap-2 text-foreground">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{tab.playerName}</span>
            </div>
          )}

          <div className="my-4 flex flex-1 items-center justify-center rounded-xl bg-primary/5">
            <div className="px-4 py-6 text-center">
              <div className="mb-1 text-xs uppercase tracking-wider text-primary/70">
                Food & Drinks Tab
              </div>
              <div className="text-sm text-muted-foreground">
                Add items, then close & bill
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end text-sm text-muted-foreground">
            <span>Started {formatTime(startTime)}</span>
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
