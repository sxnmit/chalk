"use client"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import {
  PoolTable,
  Rate,
  calculateAmountOwed,
  formatDuration,
  formatTime,
  formatCurrency,
} from "@/lib/pool-types"

export interface EndSessionModalProps {
  table: PoolTable
  rates: Rate[]
  onConfirm: () => void
  onCancel: () => void
}

export function EndSessionModal({ table, rates, onConfirm, onCancel }: EndSessionModalProps) {
  const { session } = table
  if (!session) return null

  const rate = rates.find((r) => r.id === session.rateId)
  const peakRate = rates.reduce((max, r) => Math.max(max, r.pricePerHour), 0)
  const endTime = new Date()
  const amountOwed = calculateAmountOwed(session.startTime, rate, peakRate, endTime)

  return (
    <Modal title="Session Summary" description={table.name} onClose={onCancel}>
      <div className="space-y-4">
        {session.playerName && (
          <div className="flex justify-between">
            <span className="text-text-muted">Player</span>
            <span className="font-medium text-text">{session.playerName}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-text-muted">Started</span>
          <span className="text-text">{formatTime(session.startTime)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">Ended</span>
          <span className="text-text">{formatTime(endTime)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">Duration</span>
          <span className="font-mono text-text">{formatDuration(session.startTime, endTime)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-muted">Rate</span>
          <span className="text-text">
            {rate?.name} ({formatCurrency(rate?.pricePerHour ?? 25)}/hr)
          </span>
        </div>

        <div className="border-t border-border" />

        {/* Total — most prominent */}
        <div className="flex items-center justify-between rounded-lg border border-success/20 bg-success/10 p-4">
          <span className="text-lg font-medium text-text">Amount Owed</span>
          <span className="font-display text-3xl text-success">{formatCurrency(amountOwed)}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Keep Playing
        </Button>
        <Button onClick={onConfirm} className="flex-1">
          Close Session
        </Button>
      </div>
    </Modal>
  )
}
