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

type CustomMode = null | "amount" | "percent"

interface TipSelectorProps {
  subtotalCents: number
  tipCents: number
  onTipChange: (cents: number) => void
}

export function TipSelector({ subtotalCents, tipCents, onTipChange }: TipSelectorProps) {
  const [customMode, setCustomMode] = useState<CustomMode>(null)
  const [customStr, setCustomStr] = useState("")

  const activePreset = PRESETS.find(
    (p) => Math.round(subtotalCents * p.pct) === tipCents && !customMode
  )

  function selectPreset(pct: number) {
    setCustomMode(null)
    setCustomStr("")
    onTipChange(Math.round(subtotalCents * pct))
  }

  function activateCustom(mode: CustomMode) {
    setCustomMode(mode)
    if (mode === "amount") {
      setCustomStr(tipCents > 0 ? (tipCents / 100).toFixed(2) : "")
    } else {
      const pct = subtotalCents > 0 ? (tipCents / subtotalCents) * 100 : 0
      setCustomStr(tipCents > 0 ? pct.toFixed(0) : "")
    }
  }

  function handleCustomAmountChange(value: string) {
    setCustomStr(value)
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed >= 0) {
      onTipChange(Math.round(parsed * 100))
    } else if (value === "" || value === "0") {
      onTipChange(0)
    }
  }

  function handleCustomPercentChange(value: string) {
    setCustomStr(value)
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed >= 0) {
      onTipChange(Math.round(subtotalCents * (parsed / 100)))
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

      {customMode ? (
        <div className="space-y-2">
          {/* Toggle between $ and % */}
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => activateCustom("amount")}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                customMode === "amount"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              $ Amount
            </button>
            <button
              onClick={() => activateCustom("percent")}
              className={`flex-1 py-1.5 text-xs font-medium border-l border-border/50 transition-colors ${
                customMode === "percent"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              % Percent
            </button>
          </div>

          {customMode === "amount" ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                className="pl-7 text-lg font-semibold"
                value={customStr}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                autoFocus
              />
            </div>
          ) : (
            <div className="relative">
              <Input
                className="pr-7 text-lg font-semibold"
                value={customStr}
                onChange={(e) => handleCustomPercentChange(e.target.value)}
                type="number"
                min="0"
                step="1"
                placeholder="0"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          )}

          {tipCents > 0 && (
            <p className="text-xs text-center text-muted-foreground tabular-nums">
              Tip: {formatCAD(tipCents)}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => activateCustom("amount")}
          className="w-full rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all active:scale-[0.99] hover:border-primary/30 hover:text-foreground"
        >
          Custom
        </button>
      )}
    </div>
  )
}
