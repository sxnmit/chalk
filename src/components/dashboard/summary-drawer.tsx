"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetCloseButton } from "@/components/ui/sheet"
import { loadTodaySessions, TodaySession } from "@/app/dashboard/actions"
import { formatTime, formatDuration, formatCurrency } from "@/lib/pool-types"

interface SummaryDrawerProps {
  open: boolean
  onClose: () => void
}

function sessionAmount(s: TodaySession): number {
  const hours =
    (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / (1000 * 60 * 60)
  return hours * s.actualRateCharged
}

export function SummaryDrawer({ open, onClose }: SummaryDrawerProps) {
  const [sessions, setSessions] = useState<TodaySession[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    loadTodaySessions()
      .then(setSessions)
      .finally(() => setLoading(false))
  }, [open])

  const totalRevenue = sessions.reduce((sum, s) => sum + sessionAmount(s), 0)

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent>
        {/* Header */}
        <SheetHeader>
          <SheetTitle>Today's Summary</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sessions.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No completed sessions today.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const start = new Date(s.startedAt)
              const end = new Date(s.endedAt)
              const amount = sessionAmount(s)
              const label = `${s.playerName || "Guest"} - ${s.rateLabel}`
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-foreground">{s.tableName}</span>
                    <span className="font-bold text-success">{formatCurrency(amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTime(start)}</span>
                    <span>→</span>
                    <span>{formatTime(end)}</span>
                    <span className="ml-auto font-mono">{formatDuration(start, end)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Total pinned at bottom */}
        {!loading && sessions.length > 0 && (
          <div className="border-t border-border/50 px-6 py-4">
            <div className="flex items-center justify-between rounded-xl bg-success/10 px-5 py-4">
              <span className="text-base font-medium text-foreground">Total Revenue</span>
              <span className="text-3xl font-bold text-success">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
