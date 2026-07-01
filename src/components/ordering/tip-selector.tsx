"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { formatCAD } from "@/lib/format"

const PRESETS = [
  { label: "No tip", pct: 0 },
  { label: "15%", pct: 0.15 },
  { label: "18%", pct: 0.18 },
  { label: "20%", pct: 0.20 },
]

interface TipSelectorProps {
  subtotalCents: number
  tipCents: number
  onTipChange: (cents: number) => void
}

export function TipSelector({ subtotalCents, tipCents, onTipChange }: TipSelectorProps) {
  const [customMode, setCustomMode] = useState(false)
  const [customStr, setCustomStr] = useState("")

  const activePreset = PRESETS.find(
    (p) => Math.round(subtotalCents * p.pct) === tipCents && !customMode
  )

  function selectPreset(pct: number) {
    setCustomMode(false)
    setCustomStr("")
    onTipChange(Math.round(subtotalCents * pct))
  }

  function activateCustom() {
    setCustomMode(true)
    const currentDollars = tipCents > 0 ? (tipCents / 100).toFixed(2) : ""
    setCustomStr(currentDollars)
  }

  function handleCustomChange(value: string) {
    setCustomStr(value)
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed >= 0) {
      onTipChange(Math.round(parsed * 100))
    } else if (value === "" || value === "0") {
      onTipChange(0)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Add a tip</p>
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((p) => {
          const cents = Math.round(subtotalCents * p.pct)
          const isActive = activePreset === p
          return (
            <button
              key={p.label}
              onClick={() => selectPreset(p.pct)}
              className={`flex flex-col items-center rounded-xl border px-2 py-3 text-center transition-all active:scale-[0.97] ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 bg-card text-foreground hover:border-primary/30"
              }`}
            >
              <span className="text-sm font-semibold">{p.label}</span>
              {p.pct > 0 && (
                <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {formatCAD(cents)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Custom tip */}
      {customMode ? (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            className="pl-7 text-lg font-semibold"
            value={customStr}
            onChange={(e) => handleCustomChange(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={activateCustom}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.99] ${
            customMode
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/50 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
          }`}
        >
          Custom amount
        </button>
      )}
    </div>
  )
}
