"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PoolTable, Rate, isPeakHour, formatCurrency } from "@/lib/pool-types"

export interface StartSessionModalProps {
  table: PoolTable
  rates: Rate[]
  onConfirm: (playerName: string, rateId: string) => void
  onCancel: () => void
}

export function StartSessionModal({ table, rates, onConfirm, onCancel }: StartSessionModalProps) {
  const currentlyPeak = isPeakHour(new Date())
  const playerRates = rates.filter((r) => !r.isPeakRate && r.isActive)
  const peakRate = rates.find((r) => r.isPeakRate && r.isActive)
  const tableDefaultRate = playerRates.find((r) => r.id === table.defaultRateId)
  const defaultRate = currentlyPeak
    ? (peakRate ?? playerRates[0])
    : (tableDefaultRate ?? playerRates.find((r) => r.isDefault) ?? playerRates[0])
  const [playerName, setPlayerName] = useState("")
  const [selectedRate, setSelectedRate] = useState<Rate>(defaultRate)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm(playerName.trim(), selectedRate.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 touch-manipulation">
      {/* Backdrop */}
      <div className="absolute inset-0 z-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />

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
          <h2 className="text-xl font-semibold text-foreground">Start Session</h2>
          <p className="text-sm text-muted-foreground">{table.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Player name */}
          <div className="space-y-2">
            <Label htmlFor="playerName" className="text-foreground">
              Player Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter player name"
              maxLength={30}
              className="border-border/50 focus:border-primary"
            />
            {playerName.length >= 30 && (
              <p className="text-xs text-destructive">30-character limit reached</p>
            )}
          </div>

          {/* Player type selector — hidden during peak hours */}
          {!currentlyPeak && (
            <div className="space-y-2">
              <Label className="text-foreground">Player Type</Label>
              <Select
                value={selectedRate.id}
                onValueChange={(value) => {
                  const rate = playerRates.find((r) => r.id === value)
                  if (rate) setSelectedRate(rate)
                }}
              >
                <SelectTrigger className="w-full border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {playerRates.map((rate) => (
                    <SelectItem key={rate.id} value={rate.id}>
                      {rate.name} Player — {formatCurrency(rate.pricePerHour)}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Start Session
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
