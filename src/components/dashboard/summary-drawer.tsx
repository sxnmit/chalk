"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetCloseButton } from "@/components/ui/sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { loadTodaySessions, TodaySession } from "@/app/dashboard/actions"
import { formatTime, formatDuration, formatCurrency, sessionAmount } from "@/lib/pool-types"

interface SummaryDrawerProps {
  open: boolean
  onClose: () => void
}

export function SummaryDrawer({ open, onClose }: SummaryDrawerProps) {
  const [sessions, setSessions] = useState<TodaySession[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    void Promise.resolve().then(() => {
      setLoading(true)
      loadTodaySessions()
        .then(setSessions)
        .finally(() => setLoading(false))
    })
  }, [open])

  const totalRevenue = sessions.reduce((sum, s) => sum + sessionAmount(s), 0)

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent>
        {/* Header */}
        <SheetHeader>
          <SheetTitle>Today&apos;s Summary</SheetTitle>
          <SheetCloseButton />
        </SheetHeader>

        {/* Session list */}
        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : sessions.length === 0 ? (
            <EmptyState title="No completed sessions" description="Closed sessions will appear here." className="h-full" />
          ) : (
            sessions.map((s) => {
              const start = new Date(s.startedAt)
              const end = new Date(s.endedAt)
              const amount = sessionAmount(s)
              const label = `${s.playerName || "Guest"} - ${s.rateLabel}`
              return (
                <div
                  key={s.id}
                  className="space-y-1.5 rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-text">{s.tableName}</span>
                    <span className="font-display text-xl text-success">{formatCurrency(amount)}</span>
                  </div>
                  <div className="text-xs text-text-muted">{label}</div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>{formatTime(start)}</span>
                    <span>-</span>
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
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-center justify-between rounded-lg border border-success/20 bg-success/10 px-5 py-4">
              <span className="text-base font-medium text-text">Total Revenue</span>
              <span className="font-display text-3xl text-success">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
