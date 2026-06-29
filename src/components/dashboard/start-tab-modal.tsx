"use client"

import { useState } from "react"
import { X, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface StartTabModalProps {
  onConfirm: (playerName: string) => Promise<void> | void
  onCancel: () => void
}

export function StartTabModal({ onConfirm, onCancel }: StartTabModalProps) {
  const [playerName, setPlayerName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await onConfirm(playerName.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 touch-manipulation">
      <div className="absolute inset-0 z-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-md rounded-xl border border-border/50 bg-card/95 p-6 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Start a Tab</h2>
            <p className="text-sm text-muted-foreground">
              For customers ordering food and drinks without a pool table.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tabPlayerName" className="text-foreground">
              Tab name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="tabPlayerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder='e.g. "Bar 3" or guest name'
              autoFocus
              className="border-border/50 focus:border-primary"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? "Starting…" : "Open Tab"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
