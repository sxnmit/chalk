"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PoolTable,
  Rate,
  PeakSchedule,
  calculateAmountOwed,
  formatDuration,
  formatTime,
  formatCurrency,
} from "@/lib/pool-types"

export interface EndSessionModalProps {
  table: PoolTable
  rates: Rate[]
  peakSchedule: PeakSchedule
  currency: string
  onConfirm: () => void
  onCancel: () => void
}

export function EndSessionModal({ table, rates, peakSchedule, currency, onConfirm, onCancel }: EndSessionModalProps) {
  const { session } = table
  if (!session) return null

  const rate = rates.find((r) => r.id === session.rateId)
  const peakRate = rates.reduce((max, r) => Math.max(max, r.pricePerHour), 0)
  const endTime = new Date()
  // Bill against the rate snapshotted at session start, not the rate row's
  // current price — see table-card.tsx for why these must match checkout.
  const billingRate = rate ? { ...rate, pricePerHour: session.actualRateCharged } : undefined
  const amountOwed = calculateAmountOwed(session.startTime, billingRate, peakRate, endTime, peakSchedule)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-border/50 bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Session Summary</h2>
          <p className="text-sm text-muted-foreground">{table.name}</p>
        </div>

        <div className="space-y-4">
          {session.playerName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Player</span>
              <span className="font-medium text-foreground">{session.playerName}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span className="text-foreground">{formatTime(session.startTime)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Ended</span>
            <span className="text-foreground">{formatTime(endTime)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono text-foreground">{formatDuration(session.startTime, endTime)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span className="text-foreground">
              {rate?.name} ({formatCurrency(session.actualRateCharged, currency)}/hr)
            </span>
          </div>

          <div className="border-t border-border/50" />

          {/* Total — most prominent */}
          <div className="flex items-center justify-between rounded-lg bg-success/10 p-4">
            <span className="text-lg font-medium text-foreground">Amount Owed</span>
            <span className="text-3xl font-bold text-success">{formatCurrency(amountOwed, currency)}</span>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This will end the session without recording a payment. Revenue from this session won&apos;t appear in daily totals.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Keep Playing
          </Button>
          <Button
            onClick={onConfirm}
            variant="destructive"
            className="flex-1"
          >
            End Without Billing
          </Button>
        </div>
      </div>
    </div>
  )
}
