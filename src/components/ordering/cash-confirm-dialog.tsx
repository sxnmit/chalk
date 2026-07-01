"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCAD } from "@/lib/format"

interface CashConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  grandTotalCents: number
  onConfirm: (amountReceivedCents: number) => Promise<void>
}

export function CashConfirmDialog({ open, onOpenChange, grandTotalCents, onConfirm }: CashConfirmDialogProps) {
  const [amountStr, setAmountStr] = useState((grandTotalCents / 100).toFixed(2))
  const [loading, setLoading] = useState(false)
  const [changeDue, setChangeDue] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const amountCents = Math.round(parseFloat(amountStr) * 100)
  const isValid = !isNaN(amountCents) && amountCents >= grandTotalCents

  async function handleConfirm() {
    if (!isValid) return
    setLoading(true)
    try {
      await onConfirm(amountCents)
      setChangeDue(amountCents - grandTotalCents)
      setConfirmed(true)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(v: boolean) {
    if (loading) return
    if (!v && !confirmed) {
      setChangeDue(null)
      setAmountStr((grandTotalCents / 100).toFixed(2))
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Cash Payment</DialogTitle>
          <DialogDescription>
            Total due: <span className="font-semibold text-success">{formatCAD(grandTotalCents)}</span>
          </DialogDescription>
        </DialogHeader>

        {changeDue !== null ? (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Change due</p>
              <p className="text-4xl font-bold text-success">{formatCAD(changeDue)}</p>
            </div>
            <Button className="w-full" size="lg" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cash-received">Amount received</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="cash-received"
                  className="pl-7 text-lg font-semibold"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  type="number"
                  min={(grandTotalCents / 100).toFixed(2)}
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={!isValid || loading}
              onClick={handleConfirm}
            >
              {loading ? "Processing…" : "Mark Cash Received"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
