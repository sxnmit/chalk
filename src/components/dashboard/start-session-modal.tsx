"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { PoolTable, Rate, isPeakHour, formatCurrency } from "@/lib/pool-types"
import { cn } from "@/lib/utils"

export interface StartSessionModalProps {
  table: PoolTable
  rates: Rate[]
  onConfirm: (playerName: string, rateId: string) => void
  onCancel: () => void
}

export function StartSessionModal({ table, rates, onConfirm, onCancel }: StartSessionModalProps) {
  const currentlyPeak = isPeakHour(new Date())
  const playerRates = rates.filter((r) => !r.isPeakRate)
  const peakRate = rates.find((r) => r.isPeakRate)
  const defaultRate = currentlyPeak
    ? (peakRate ?? playerRates[0])
    : (playerRates.find((r) => r.isDefault) ?? playerRates[0])
  const [playerName, setPlayerName] = useState("")
  const [selectedRate, setSelectedRate] = useState<Rate>(defaultRate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm(playerName.trim(), selectedRate.id)
  }

  return (
    <Modal title="Start Session" description={table.name} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Player name */}
        <div className="space-y-2">
          <Label htmlFor="playerName" className="text-text">
            Player Name <span className="text-text-muted">(optional)</span>
          </Label>
          <Input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter player name"
          />
        </div>

        {/* Player type selector — hidden during peak hours */}
        {!currentlyPeak && (
          <div className="space-y-2">
            <Label className="text-text">Player Type</Label>
            <div className="grid gap-2">
              {playerRates.map((rate) => (
                <button
                  key={rate.id}
                  type="button"
                  onClick={() => setSelectedRate(rate)}
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-[var(--radius)] border p-3 text-left transition-colors",
                    selectedRate.id === rate.id
                      ? "border-chalk bg-chalk-soft text-chalk"
                      : "border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
                  )}
                >
                  <span className="font-medium">{rate.name} Player</span>
                  <span className="text-sm">{formatCurrency(rate.pricePerHour)}/hr</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Start Session
          </Button>
        </div>
      </form>
    </Modal>
  )
}
