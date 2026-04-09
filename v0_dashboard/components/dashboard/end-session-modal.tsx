"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PoolTable,
  RATES,
  calculateAmountOwed,
  formatDuration,
  formatTime,
  formatCurrency,
} from "@/lib/types"

interface EndSessionModalProps {
  table: PoolTable
  onConfirm: () => void
  onCancel: () => void
}

export function EndSessionModal({
  table,
  onConfirm,
  onCancel,
}: EndSessionModalProps) {
  const session = table.session
  if (!session) return null

  const rate = RATES.find((r) => r.id === session.rateId)
  const endTime = new Date()
  const amountOwed = calculateAmountOwed(
    session.startTime,
    rate?.pricePerHour || 15
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-border/50 bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Session Summary
          </h2>
          <p className="text-sm text-muted-foreground">{table.name}</p>
        </div>

        {/* Session details */}
        <div className="space-y-4">
          {/* Player name if set */}
          {session.playerName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Player</span>
              <span className="font-medium text-foreground">
                {session.playerName}
              </span>
            </div>
          )}

          {/* Times */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span className="text-foreground">
              {formatTime(session.startTime)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Ended</span>
            <span className="text-foreground">{formatTime(endTime)}</span>
          </div>

          {/* Duration */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono text-foreground">
              {formatDuration(session.startTime, endTime)}
            </span>
          </div>

          {/* Rate */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span className="text-foreground">
              {rate?.name} ({formatCurrency(rate?.pricePerHour || 15)}/hr)
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Total amount - prominent */}
          <div className="flex items-center justify-between rounded-lg bg-success/10 p-4">
            <span className="text-lg font-medium text-foreground">
              Amount Owed
            </span>
            <span className="text-3xl font-bold text-success">
              {formatCurrency(amountOwed)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Keep Playing
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Close Session
          </Button>
        </div>
      </div>
    </div>
  )
}
